import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	validateAuthorizationCode, 
	getUserInfo, 
	findOrCreateOIDCUser,
	isOIDCConfigured 
} from '$lib/server/services/oidc';

export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!isOIDCConfigured()) {
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
		const tokens = await validateAuthorizationCode(code, codeVerifier);

		// Get user info
		const userInfo = await getUserInfo(tokens.accessToken);

		// Find or create user and create session (pass tokens to store access token)
		const { sessionId, isNewUser } = await findOrCreateOIDCUser(userInfo, tokens);

		// Set session cookie
		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});

		// Redirect to home or welcome page for new users
		if (isNewUser) {
			throw redirect(302, '/?welcome=true');
		}

		throw redirect(302, '/');
	} catch (e) {
		if (e instanceof Response) throw e;
		console.error('OIDC callback error:', e);
		throw redirect(302, '/auth/login?error=authentication_failed');
	}
};
