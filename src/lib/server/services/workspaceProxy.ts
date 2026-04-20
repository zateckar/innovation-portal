/**
 * Workspace Proxy
 *
 * Forwards requests to workspace SSR node servers. Extracted into a
 * shared module so both hooks.server.ts (primary path — intercepts ALL
 * workspace requests before SvelteKit routing) and the fallback
 * +server.ts route can reuse the same logic.
 */

import { error } from '@sveltejs/kit';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import {
	getOrStartWorkspacePort,
	readLastRuntimeErrors
} from '$lib/server/services/workspaceProcessManager';
import { signIdentity } from '$lib/server/services/workspaceIdentity';
import type { SessionUser } from '$lib/server/services/auth';

const WORKSPACES_ROOT = resolve('workspaces');

/** Trust boundary for the public origin forwarded to child apps. */
const TRUSTED_FORWARDED_HOST =
	process.env.PUBLIC_ORIGIN_HOST ??
	(() => {
		try {
			return process.env.PUBLIC_ORIGIN ? new URL(process.env.PUBLIC_ORIGIN).host : null;
		} catch {
			return null;
		}
	})();

/**
 * Proxy a request to a workspace's SSR node server.
 */
export async function proxyWorkspaceRequest(
	request: Request,
	user: SessionUser,
	uuid: string,
	version: string
): Promise<Response> {
	// Defensive validation — even though hooks.server.ts already restricts
	// the URL pattern, this function is exported and could be called from
	// elsewhere. Reject anything but a small positive integer.
	const versionNum = parseInt(version, 10);
	if (!Number.isFinite(versionNum) || versionNum < 1 || versionNum > 9999) {
		throw error(400, `Invalid version '${version}'`);
	}
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
		throw error(400, 'Invalid workspace UUID');
	}

	// Check deployment exists
	const deployDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'deployment');
	if (!existsSync(deployDir)) {
		throw error(404, `Workspace ${uuid} v${version} not found or not deployed`);
	}

	// Get or start workspace process
	const port = await getOrStartWorkspacePort(uuid, versionNum);
	if (!port) {
		const errs = readLastRuntimeErrors(uuid, versionNum, 3);
		const tail = errs.length ? `\nLast errors:\n${errs.join('\n')}` : '';
		throw error(503, `Workspace ${uuid} v${version} could not be started.${tail}`);
	}

	const originalUrl = new URL(request.url);
	const isActionRequest = originalUrl.search.startsWith('?/');
	// Append a trailing slash to "page-like" paths so the child SvelteKit
	// server's trailing-slash-required mode doesn't 308 us back. BUT skip
	// this for file-like segments — i.e. anything whose last path segment
	// contains a `.`. That covers:
	//   - SvelteKit's internal `__data.json` endpoint used by client-side
	//     navigation (without this exception every CSR `goto()` inside a
	//     child app logs `[404] GET …/__data.json/` and falls back to a
	//     full page reload, breaking client state).
	//   - Static assets (`.png`, `.css`, `.js`, …) which must never carry
	//     a trailing slash.
	const lastSegment = originalUrl.pathname.split('/').pop() ?? '';
	const isFileLike = lastSegment.includes('.');
	const normalizedPathname =
		isActionRequest || isFileLike || originalUrl.pathname.endsWith('/')
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
	forwardHeaders.delete('accept-encoding');

	// Pin the forwarded host to a trusted server-side value when one is
	// configured. Otherwise fall back to the request's host (legacy behaviour).
	// Without pinning, a misconfigured CDN that allows arbitrary `Host:`
	// headers becomes an open-redirect / phishing vector — the child app
	// would generate links pointing at attacker-controlled hosts.
	const forwardedHost = TRUSTED_FORWARDED_HOST ?? originalUrl.host;
	forwardHeaders.set('x-forwarded-host', forwardedHost);
	forwardHeaders.set('x-forwarded-proto', originalUrl.protocol.replace(':', ''));

	// Forward authenticated user identity. Strip any spoofed headers from
	// the inbound request first (a hostile client could try to set these
	// directly on a request that bypasses our auth handler).
	for (const k of [
		'x-user-id',
		'x-user-email',
		'x-user-name',
		'x-user-role',
		'x-user-department',
		'x-user-sig',
		'x-user-sig-ts'
	]) {
		forwardHeaders.delete(k);
	}
	forwardHeaders.set('x-user-id', user.id);
	forwardHeaders.set('x-user-email', user.email);
	forwardHeaders.set('x-user-name', user.name);
	forwardHeaders.set('x-user-role', user.role);
	forwardHeaders.set('x-user-department', user.department ?? '');

	// HMAC-sign the identity so AI-generated apps can verify it (when they
	// choose to enforce). Even if they don't, the signature is a
	// tamper-evidence channel an opt-in fix can use.
	const ts = Date.now();
	const sig = signIdentity(
		{
			id: user.id,
			email: user.email,
			name: user.name,
			role: user.role,
			department: user.department ?? null
		},
		ts
	);
	forwardHeaders.set('x-user-sig', sig);
	forwardHeaders.set('x-user-sig-ts', String(ts));

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

		// Handle SvelteKit normalize redirects (see prior comment block above).
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
					body: null
				});
			}
		}

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
		// Surface the actual cause from the child's runtime log — without
		// this, every 502 looks identical and users have no idea their app
		// crashed (the real error is buried in workspaces/.../runtime.log).
		const errs = readLastRuntimeErrors(uuid, versionNum, 2);
		const tail = errs.length ? ` Last error: ${errs[errs.length - 1]}` : '';
		throw error(502, `Workspace proxy error: ${message}.${tail}`);
	}
}
