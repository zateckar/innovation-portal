import { redirect } from '@sveltejs/kit';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { deleteSession, validateSession } from '$lib/server/services/auth';
import { isOIDCConfigured, getDiscoveryDocument } from '$lib/server/services/oidc';
import { env } from '$env/dynamic/private';

async function performLogout(cookies: Cookies, requestOrigin: string): Promise<never> {
	const sessionId = cookies.get('session');

	// Capture access token before deleting the session (needed for OIDC logout hint)
	let accessToken: string | null = null;
	if (sessionId) {
		const sessionUser = await validateSession(sessionId);
		accessToken = sessionUser?.accessToken ?? null;
		await deleteSession(sessionId);
	}

	cookies.delete('session', { path: '/' });

	// Attempt OIDC RP-Initiated Logout if configured
	try {
		if (await isOIDCConfigured()) {
			const discovery = await getDiscoveryDocument();
			if (discovery.end_session_endpoint) {
				const appUrl = env.PUBLIC_APP_URL || requestOrigin;
				const endSessionUrl = new URL(discovery.end_session_endpoint);
				endSessionUrl.searchParams.set('post_logout_redirect_uri', `${appUrl}/auth/login`);
				if (accessToken) {
					// id_token_hint is preferred but we store access_token; use it as a hint
					endSessionUrl.searchParams.set('id_token_hint', accessToken);
				}
				throw redirect(302, endSessionUrl.toString());
			}
		}
	} catch (e) {
		// If the redirect was thrown by us, re-throw it
		if (e instanceof Response) throw e;
		// Otherwise (discovery failure, etc.) fall through to local redirect
		console.error('[logout] OIDC end_session redirect failed, falling back to local logout:', e);
	}

	throw redirect(302, '/auth/login');
}

// Support GET for direct navigation (e.g. links, typed URL)
export async function GET({ cookies, url }: RequestEvent) {
	return performLogout(cookies, url.origin);
}

// Support POST for form-based logout (Header component uses a <form method="POST">)
export async function POST({ cookies, url }: RequestEvent) {
	return performLogout(cookies, url.origin);
}
