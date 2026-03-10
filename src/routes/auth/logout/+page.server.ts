import type { Actions } from './$types';
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/services/auth';

// Logout is POST-only to prevent CSRF-style forced logout via GET requests (e.g. <img> tags).
// Any GET to /auth/logout will receive a 405 Method Not Allowed from SvelteKit.
export const actions: Actions = {
	default: async ({ cookies }) => {
		const sessionId = cookies.get('session');
		
		if (sessionId) {
			await deleteSession(sessionId);
		}
		
		cookies.delete('session', { path: '/' });
		throw redirect(302, '/auth/login');
	}
};
