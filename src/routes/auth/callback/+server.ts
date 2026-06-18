import { redirect, isRedirect, isHttpError } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	validateAuthorizationCode, 
	getUserInfo, 
	findOrCreateOIDCUser,
	isOIDCConfigured 
} from '$lib/server/services/oidc';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!await isOIDCConfigured()) {
		throw redirect(302, '/auth/login?error=oidc_not_configured');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const error = url.searchParams.get('error');

	// Handle OIDC provider errors
	if (error) {
		const errorDescription = url.searchParams.get('error_description') || error;
		console.error('OIDC callback error:', errorDescription);
		throw redirect(302, `/auth/login?error=oidc_provider_error`);
	}

	if (!code || !state) {
		throw redirect(302, '/auth/login?error=invalid_callback');
	}

	// Verify state
	const storedState = cookies.get('oidc_state');
	const codeVerifier = cookies.get('oidc_code_verifier');

	if (!storedState || !codeVerifier || state !== storedState) {
		console.error('OIDC state mismatch');
		throw redirect(302, '/auth/login?error=invalid_state');
	}

	// Clear state cookies
	cookies.delete('oidc_state', { path: '/' });
	cookies.delete('oidc_code_verifier', { path: '/' });

	try {
		// Exchange code for tokens
		const tokens = await validateAuthorizationCode(code, codeVerifier, url.origin);

		// Get user info
		const userInfo = await getUserInfo(tokens.accessToken);

		// Find or create user and create session (pass tokens to store access token)
		const { sessionId, isNewUser } = await findOrCreateOIDCUser(userInfo, tokens);

		// Set session cookie
		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			secure: true,
			// lax (not strict) so the cookie is sent on the top-level GET redirect to '/'
			// that follows the cross-site return from the OIDC provider. With strict the
			// browser withholds it on that navigation and the user bounces to /auth/login.
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		// IMPORTANT: do NOT 302 straight to '/' here. The browser treats the
		// server redirect as a continuation of the cross-site redirect chain from
		// the OIDC provider and omits the freshly-set SameSite=Lax session cookie
		// ("...omitted because of a cross-site redirect"), so '/' loads logged-out
		// and bounces back to /auth/login.
		//
		// Instead return a same-site HTML landing page that navigates client-side.
		// That second navigation originates from our own document, so it is a
		// genuine same-site request and the Lax cookie is sent.
		const dest = isNewUser ? '/?welcome=true' : '/';
		const escapedDest = dest.replace(/"/g, '%22');
		return new Response(
			`<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=${escapedDest}"><title>Signing in…</title><script>location.replace(${JSON.stringify(dest)})</script></head><body>Signing you in… <a href="${escapedDest}">Continue</a></body></html>`,
			{ status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
		);
	} catch (e) {
		// redirect()/error() throw framework control-flow objects (not Response) —
		// re-throw them so successful-login redirects aren't swallowed as errors.
		if (isRedirect(e) || isHttpError(e)) throw e;
		console.error('OIDC callback error:', e);
		throw redirect(302, '/auth/login?error=authentication_failed');
	}
};
