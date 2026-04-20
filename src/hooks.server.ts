import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, renewSession, initializeAdminFromEnv, type SessionUser } from '$lib/server/services/auth';
import { initializeJobs } from '$lib/server/jobs/scheduler';
import { patchConsole, setLogLevel, type LogLevel } from '$lib/server/logger';
import { db, settings, getRawDb } from '$lib/server/db';
import { proxyWorkspaceRequest } from '$lib/server/services/workspaceProxy';
import {
	reapOrphanWorkspaceProcesses,
	stopAllWorkspaceProcesses
} from '$lib/server/services/workspaceProcessManager';
import { startBuildWatchdog, stopBuildWatchdog } from '$lib/server/services/buildWatchdog';

// Patch console once at startup so all console.* calls are written to the log file.
patchConsole();

// ─── Initialization ───────────────────────────────────────────────────────────

// Track whether initialization has settled so we do not re-await on every request.
let initDone = false;
let initError: unknown = null;

const initPromise = initializeAdminFromEnv()
	.then(async () => {
		// Run additive schema migrations for new columns (safe to run repeatedly)
		const migrations = [
			"ALTER TABLE users ADD COLUMN department TEXT",
			"ALTER TABLE innovations ADD COLUMN department TEXT DEFAULT 'general'",
			"ALTER TABLE catalog_items ADD COLUMN department TEXT DEFAULT 'general'"
		];
		for (const migration of migrations) {
			try {
				getRawDb().prepare(migration).run();
			} catch {
				// SQLite throws if the column already exists — this is expected on subsequent boots
			}
		}

		// Backfill NULL department values to 'general' for existing rows.
		// SQLite ALTER TABLE ADD COLUMN only applies DEFAULT to new inserts;
		// rows that existed before the migration retain NULL.
		getRawDb().prepare("UPDATE innovations SET department = 'general' WHERE department IS NULL").run();
		getRawDb().prepare("UPDATE catalog_items SET department = 'general' WHERE department IS NULL").run();

		// Load log level from DB settings (overrides env var if set in UI)
		try {
			const [row] = await db.select({ logLevel: settings.logLevel }).from(settings);
			if (row?.logLevel) {
				setLogLevel(row.logLevel as LogLevel);
			}
		} catch {
			// DB may not have the column yet (pre-migration) — ignore
		}
		// Reap any workspace child processes that survived the previous portal run.
		// Without this, EADDRINUSE on their ports causes new spawns to fail and
		// the orphans serve stale code forever.
		try {
			reapOrphanWorkspaceProcesses();
		} catch (e) {
			console.warn('[init] reapOrphanWorkspaceProcesses failed:', e);
		}

		// Start background jobs only after initialization is fully complete so that
		// the first job tick runs with the correct log level and admin user in place.
		initializeJobs();

		// Start the build watchdog — consumes workspaces/<uuid>/heartbeat.json
		// and marks builds as failed when stale, so a stuck OpenCode call
		// doesn't keep a workspace in 'building' forever.
		startBuildWatchdog();
	})
	.catch((err) => {
		// Capture the error so individual requests can surface it rather than
		// re-throwing a rejected Promise on every incoming request.
		initError = err;
		console.error('[init] Startup initialization failed:', err);
	})
	.finally(() => {
		initDone = true;
	});

// Session renewal throttle: extend expiry at most once per 10 minutes per session.
const SESSION_RENEWAL_INTERVAL_MS = 10 * 60 * 1000;
const SESSION_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — matches auth.ts
const lastRenewedAt = new Map<string, number>();

function cleanupStaleRenewalEntries() {
	const cutoff = Date.now() - SESSION_IDLE_TIMEOUT_MS;
	for (const [key, ts] of lastRenewedAt) {
		if (ts < cutoff) lastRenewedAt.delete(key);
	}
}

export const handle: Handle = async ({ event, resolve }) => {
	// Wait for initialization only until it has settled (resolved or rejected).
	if (!initDone) await initPromise;

	// Surface a startup failure as a 503 to avoid silently serving a broken app.
	if (initError) {
		console.error('[request] Startup failed — serving degraded:', initError);
		// Do not throw: allow the app to continue in a degraded state.
	}

	const sessionId = event.cookies.get('session');

	if (sessionId) {
		let user: SessionUser | null = null;
		try {
			user = await validateSession(sessionId);
		} catch {
			// DB unavailable — treat as unauthenticated instead of crashing
			console.warn('[session] validateSession failed, treating as unauthenticated');
		}
		if (user) {
			event.locals.user = user;

			// Sliding session renewal: extend expiry periodically without a DB write
			// on every single request.
			const now = Date.now();
			const last = lastRenewedAt.get(sessionId) ?? 0;
			if (now - last > SESSION_RENEWAL_INTERVAL_MS) {
				lastRenewedAt.set(sessionId, now);
			// Fire-and-forget renewal — does not block the response
			renewSession(sessionId).catch((e: unknown) => console.warn('[session] Renewal failed:', e));
			// Periodically evict stale entries to prevent unbounded growth
			if (Math.random() < 0.01) cleanupStaleRenewalEntries();
			}
		} else {
			// Invalid or expired session — clear cookie with secure attributes
			event.cookies.delete('session', {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production'
			});
			// Clean up renewal tracker
			lastRenewedAt.delete(sessionId);
		}
	}

	// ── Workspace proxy ─────────────────────────────────────────────────────────
	// Intercept workspace requests BEFORE SvelteKit's routing to prevent the
	// framework from consuming special URL patterns (__data.json, ?/action, etc.)
	// that would otherwise 404 because the proxy route only has +server.ts.
	const workspaceMatch = event.url.pathname.match(
		/^\/apps\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/v(\d+)(\/|$)/
	);
	if (workspaceMatch) {
		if (!event.locals.user) {
			throw redirect(302, '/auth/login');
		}
		const response = await proxyWorkspaceRequest(
			event.request,
			event.locals.user,
			workspaceMatch[1],
			workspaceMatch[2]
		);
		// Still apply security headers before returning
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set('X-Frame-Options', 'SAMEORIGIN');
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
		return response;
	}

	const response = await resolve(event);

	// Security headers — applied to every response
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

	if (process.env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	// Content Security Policy
	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",   // SvelteKit SSR hydration requires unsafe-inline
		"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",    // Tailwind + highlight.js + Google Fonts
		"img-src 'self' data: https:",         // news feed images from arbitrary external URLs
		"font-src 'self' https://fonts.gstatic.com",
		"connect-src 'self'",
		"frame-src 'self'",                    // AI-generated HTML iframes (same-origin API route)
		"worker-src 'self' blob:",             // Mermaid uses blob: web workers
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
	].join('; ');
	response.headers.set('Content-Security-Policy', csp);

	return response;
};

// ─── Graceful shutdown ────────────────────────────────────────────────────────
// Kill spawned workspace child apps and stop the watchdog so a
// portal restart doesn't leak processes / timers.
function shutdown(signal: string) {
	console.warn(`[shutdown] Received ${signal} — stopping workspace processes and watchdog`);
	try {
		stopBuildWatchdog();
	} catch {
		// noop
	}
	try {
		stopAllWorkspaceProcesses();
	} catch {
		// noop
	}
}
process.once('SIGTERM', () => {
	shutdown('SIGTERM');
});
process.once('SIGINT', () => {
	shutdown('SIGINT');
});
