import type { Actions, PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { deleteSession } from '$lib/server/services/auth';

// Handle GET request to /auth/logout - allows direct navigation
export const load: PageServerLoad = async ({ cookies }) => {
	const sessionId = cookies.get('session');
	
	if (sessionId) {
		await deleteSession(sessionId);
	}
	
	cookies.delete('session', { path: '/' });
	throw redirect(302, '/auth/login');
};

// Handle POST request from logout form
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
