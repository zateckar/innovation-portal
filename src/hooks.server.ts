import type { Handle } from '@sveltejs/kit';
import { validateSession, renewSession, initializeAdminFromEnv, type SessionUser } from '$lib/server/services/auth';
import { initializeJobs } from '$lib/server/jobs/scheduler';
import { patchConsole, setLogLevel, type LogLevel } from '$lib/server/logger';
import { db, settings } from '$lib/server/db';

// Patch console once at startup so all console.* calls are written to the log file.
patchConsole();

// ─── Initialization ───────────────────────────────────────────────────────────

// Track whether initialization has settled so we do not re-await on every request.
let initDone = false;
let initError: unknown = null;

const initPromise = initializeAdminFromEnv()
	.then(async () => {
		// Load log level from DB settings (overrides env var if set in UI)
		try {
			const [row] = await db.select({ logLevel: settings.logLevel }).from(settings);
			if (row?.logLevel) {
				setLogLevel(row.logLevel as LogLevel);
			}
		} catch {
			// DB may not have the column yet (pre-migration) — ignore
		}
		// Start background jobs only after initialization is fully complete so that
		// the first job tick runs with the correct log level and admin user in place.
		initializeJobs();
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
const lastRenewedAt = new Map<string, number>();

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
		const user = await validateSession(sessionId);
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

	return resolve(event);
};
