import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { getOrStartWorkspacePort } from '$lib/server/services/workspaceProcessManager';
import { validateSession } from '$lib/server/services/auth';

const WORKSPACES_ROOT = resolve('workspaces');

/**
 * Proxy all requests to the workspace's SSR node server.
 *
 * Authentication contract:
 *   - The main app validates the session cookie before proxying.
 *   - User identity is forwarded to the workspace as trusted headers:
 *       x-user-id       — stable user ID
 *       x-user-email    — user email
 *       x-user-name     — display name
 *       x-user-role     — "user" | "admin"
 *       x-user-department — department (may be empty)
 *   - The original Cookie header is forwarded as-is so the workspace can
 *     set/read its own cookies (e.g. for UI preferences), but the workspace
 *     must NOT rely on the main app's session cookie.
 *   - Workspace apps must never implement their own login/logout; they read
 *     event.locals.user (populated by their hooks.server.ts from the headers above).
 */
async function proxyToWorkspace(
	request: Request,
	cookies: { get: (name: string) => string | undefined },
	uuid: string,
	version: string
): Promise<Response> {
	// Validate UUID format (prevent directory traversal)
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
		throw error(400, 'Invalid workspace UUID');
	}

	// Validate version format
	if (!/^\d+$/.test(version)) {
		throw error(400, 'Invalid version');
	}

	const versionNum = parseInt(version, 10);

	// ── Auth: validate the main-app session ──────────────────────────────────
	const sessionId = cookies.get('session');
	if (!sessionId) {
		throw redirect(302, '/auth/login');
	}
	const sessionUser = await validateSession(sessionId);
	if (!sessionUser) {
		throw redirect(302, '/auth/login');
	}

	// Check deployment exists
	const deployDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'deployment');
	if (!existsSync(deployDir)) {
		throw error(404, `Workspace ${uuid} v${version} not found or not deployed`);
	}

	// Get or start workspace process
	const port = await getOrStartWorkspacePort(uuid, versionNum);
	if (!port) {
		throw error(503, `Workspace ${uuid} v${version} could not be started`);
	}

	// Build the proxied URL — forward the full original path so the workspace server
	// can handle routing (its base path is already set to /apps/[uuid]/v[version])
	const originalUrl = new URL(request.url);
	const proxyUrl = `http://127.0.0.1:${port}${originalUrl.pathname}${originalUrl.search}`;

	// Build forwarding headers
	const forwardHeaders = new Headers(request.headers);
	forwardHeaders.delete('host');
	forwardHeaders.delete('connection');
	forwardHeaders.delete('keep-alive');
	forwardHeaders.delete('transfer-encoding');
	forwardHeaders.delete('upgrade');
	forwardHeaders.set('x-forwarded-host', originalUrl.host);
	forwardHeaders.set('x-forwarded-proto', originalUrl.protocol.replace(':', ''));

	// Forward authenticated user identity as trusted headers
	forwardHeaders.set('x-user-id', sessionUser.id);
	forwardHeaders.set('x-user-email', sessionUser.email);
	forwardHeaders.set('x-user-name', sessionUser.name);
	forwardHeaders.set('x-user-role', sessionUser.role);
	forwardHeaders.set('x-user-department', sessionUser.department ?? '');

	// Forward the request
	try {
		let proxyResponse = await fetch(proxyUrl, {
			method: request.method,
			headers: forwardHeaders,
			body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
			// @ts-ignore — duplex is needed for streaming request bodies
			duplex: 'half',
			signal: AbortSignal.timeout(30_000)
		});

		// The workspace (adapter-node SvelteKit) emits x-sveltekit-normalize redirects for
		// trailing-slash normalisation.  The main app does the same in the opposite direction
		// (removing trailing slashes), which creates an infinite redirect loop in the browser.
		// Break the loop by following one level of trailing-slash redirects internally.
		if (
			(proxyResponse.status === 308 || proxyResponse.status === 307) &&
			proxyResponse.headers.get('x-sveltekit-normalize') === '1'
		) {
			const location = proxyResponse.headers.get('location');
			if (location) {
				const followUrl = location.startsWith('http')
					? location
					: `http://127.0.0.1:${port}${location}`;
				proxyResponse = await fetch(followUrl, {
					method: request.method,
					headers: forwardHeaders
				});
			}
		}

		// Build response headers, filtering hop-by-hop headers
		const responseHeaders = new Headers();
		proxyResponse.headers.forEach((value, key) => {
			const lower = key.toLowerCase();
			if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(lower)) return;
			responseHeaders.set(key, value);
		});

		return new Response(proxyResponse.body, {
			status: proxyResponse.status,
			statusText: proxyResponse.statusText,
			headers: responseHeaders
		});
	} catch (err) {
		if (err instanceof DOMException && err.name === 'AbortError') {
			throw error(504, 'Workspace request timed out after 30 seconds');
		}
		const message = err instanceof Error ? err.message : String(err);
		console.error(`[apps proxy] Error proxying to workspace ${uuid} v${version}:`, message);
		throw error(502, `Workspace proxy error: ${message}`);
	}
}

const handler: RequestHandler = async ({ request, params, cookies }) => {
	const { uuid, version } = params;

	if (!uuid || !version) {
		throw error(400, 'Missing workspace UUID or version');
	}

	return proxyToWorkspace(request, cookies, uuid, version);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
