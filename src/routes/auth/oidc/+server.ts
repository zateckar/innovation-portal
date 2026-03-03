import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAuthorizationURL, isOIDCConfigured } from '$lib/server/services/oidc';

export const GET: RequestHandler = async ({ cookies }) => {
	if (!isOIDCConfigured()) {
		throw redirect(302, '/auth/login?error=oidc_not_configured');
	}

	try {
		const { url, state } = await createAuthorizationURL();
		
		// Store state and code verifier in cookies for verification
		cookies.set('oidc_state', state.state, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 10 // 10 minutes
		});
		
		cookies.set('oidc_code_verifier', state.codeVerifier, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 10 // 10 minutes
		});

		throw redirect(302, url.toString());
	} catch (e) {
		if (e instanceof Response) throw e;
		console.error('OIDC login error:', e);
		throw redirect(302, '/auth/login?error=oidc_error');
	}
};
