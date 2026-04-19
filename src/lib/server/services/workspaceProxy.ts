/**
 * Workspace Proxy
 *
 * Forwards requests to workspace SSR node servers.  Extracted into a shared
 * module so both hooks.server.ts (primary path — intercepts ALL workspace
 * requests before SvelteKit routing) and the fallback +server.ts route can
 * reuse the same logic.
 */

import { error } from '@sveltejs/kit';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { getOrStartWorkspacePort } from '$lib/server/services/workspaceProcessManager';
import type { SessionUser } from '$lib/server/services/auth';

const WORKSPACES_ROOT = resolve('workspaces');

/**
 * Proxy a request to a workspace's SSR node server.
 *
 * @param request  — the incoming Request (headers are cloned & forwarded)
 * @param user     — already-validated session user (from hooks)
 * @param uuid     — workspace UUID
 * @param version  — version string (digits only)
 */
export async function proxyWorkspaceRequest(
	request: Request,
	user: SessionUser,
	uuid: string,
	version: string
): Promise<Response> {
	const versionNum = parseInt(version, 10);

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

	// Build the proxied URL — forward the full original path so the workspace
	// server can handle routing (its base path is /apps/[uuid]/v[version]).
	// SvelteKit workspace apps normalise paths to always have a trailing slash
	// before the query string; if the pathname is missing it, the app returns a
	// 308 redirect which Node's fetch() throws as UnexpectedRedirect.  Ensure
	// the pathname always ends with "/" so we never trigger that redirect.
	//
	// EXCEPTION: SvelteKit form actions use the query string "?/actionName".
	// When the search starts with "?/", the workspace app expects NO trailing
	// slash on the pathname — adding one triggers the normalize 308 redirect
	// which causes the request body to be dropped (body can't be re-sent after
	// a redirect in Node fetch).
	const originalUrl = new URL(request.url);
	const isActionRequest = originalUrl.search.startsWith('?/');
	const normalizedPathname =
		isActionRequest || originalUrl.pathname.endsWith('/')
			? originalUrl.pathname
			: originalUrl.pathname + '/';
	const proxyUrl = `http://127.0.0.1:${port}${normalizedPathname}${originalUrl.search}`;

	// Build forwarding headers
	const forwardHeaders = new Headers(request.headers);
	forwardHeaders.delete('host');
	forwardHeaders.delete('connection');
	forwardHeaders.delete('keep-alive');
	forwardHeaders.delete('transfer-encoding');
	forwardHeaders.delete('upgrade');
	// Remove Accept-Encoding so the workspace serves uncompressed responses.
	// Without this, the workspace's sirv middleware serves pre-compressed .br/.gz
	// files with Content-Encoding headers.  Node's fetch() then auto-decompresses
	// the body but the Content-Encoding header survives into the final response,
	// causing the browser to attempt double-decompression → ERR_CONTENT_DECODING_FAILED.
	forwardHeaders.delete('accept-encoding');
	forwardHeaders.set('x-forwarded-host', originalUrl.host);
	forwardHeaders.set('x-forwarded-proto', originalUrl.protocol.replace(':', ''));

	// Forward authenticated user identity as trusted headers
	forwardHeaders.set('x-user-id', user.id);
	forwardHeaders.set('x-user-email', user.email);
	forwardHeaders.set('x-user-name', user.name);
	forwardHeaders.set('x-user-role', user.role);
	forwardHeaders.set('x-user-department', user.department ?? '');

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

		// The workspace (adapter-node SvelteKit) may emit x-sveltekit-normalize
		// redirects for trailing-slash normalisation.  The main app does the same
		// in the opposite direction (removing trailing slashes), creating an
		// infinite redirect loop.  Break it by following one level internally.
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
					headers: forwardHeaders,
					// NOTE: request.body is already consumed above; this branch is only
					// reached for GET/HEAD normalize redirects in practice (SvelteKit
					// sends normalize redirects for GET requests — POST actions always
					// have a trailing slash in the action URL).
					body: null
				});
			}
		}

		// Build response headers, filtering hop-by-hop and encoding headers.
		const responseHeaders = new Headers();
		proxyResponse.headers.forEach((value, key) => {
			const lower = key.toLowerCase();
			if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(lower)) return;
			if (lower === 'content-encoding') return;
			if (lower === 'content-length') return;
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
