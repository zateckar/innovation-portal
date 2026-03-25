import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { verifyCredentials, createSession } from '$lib/server/services/auth';
import { isOIDCConfigured } from '$lib/server/services/oidc';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		throw redirect(302, '/');
	}
	
	const error = url.searchParams.get('error');
	const oidcEnabled = await isOIDCConfigured();
	
	return {
		oidcEnabled,
		error: error ? getErrorMessage(error) : null
	};
};

function getErrorMessage(errorCode: string): string {
	const messages: Record<string, string> = {
		'oidc_not_configured': 'SSO is not configured on this server.',
		'oidc_error': 'An error occurred during SSO login. Please try again.',
		'oidc_provider_error': 'The identity provider rejected the login request.',
		'invalid_callback': 'Invalid login callback. Please try again.',
		'invalid_state': 'Session expired. Please try logging in again.',
		'authentication_failed': 'Authentication failed. Please try again.'
	};
	return messages[errorCode] || 'An unknown error occurred.';
}

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString();
		const password = formData.get('password')?.toString();
		
		if (!email || !password) {
			return fail(400, { error: 'Email and password are required', email });
		}
		
		const user = await verifyCredentials(email, password);
		
		if (!user) {
			return fail(401, { error: 'Invalid email or password', email });
		}
		
		const sessionId = await createSession(user.id);
		
		cookies.set('session', sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 30 // 30 days
		});
		
		throw redirect(302, '/');
	}
};
