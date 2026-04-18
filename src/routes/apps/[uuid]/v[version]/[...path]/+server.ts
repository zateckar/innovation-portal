/**
 * Fallback route handler for workspace proxy requests.
 *
 * The primary proxy path is in hooks.server.ts, which intercepts workspace
 * requests BEFORE SvelteKit's routing.  This handler exists as a safety net
 * in case a request somehow reaches SvelteKit's router (e.g. the hook regex
 * doesn't match an edge-case URL).
 */
import type { RequestHandler } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { validateSession } from '$lib/server/services/auth';
import { proxyWorkspaceRequest } from '$lib/server/services/workspaceProxy';

const handler: RequestHandler = async ({ request, params, cookies }) => {
	const { uuid, version } = params;

	if (!uuid || !version) {
		throw error(400, 'Missing workspace UUID or version');
	}

	// Validate UUID format (prevent directory traversal)
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
		throw error(400, 'Invalid workspace UUID');
	}
	if (!/^\d+$/.test(version)) {
		throw error(400, 'Invalid version');
	}

	// Auth — the hook normally handles this, but validate again for safety
	const sessionId = cookies.get('session');
	if (!sessionId) {
		throw redirect(302, '/auth/login');
	}
	const sessionUser = await validateSession(sessionId);
	if (!sessionUser) {
		throw redirect(302, '/auth/login');
	}

	return proxyWorkspaceRequest(request, sessionUser, uuid, version);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
