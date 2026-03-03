import type { Handle } from '@sveltejs/kit';
import { validateSession, initializeAdminFromEnv, type SessionUser } from '$lib/server/services/auth';

// Initialize admin from environment variables on startup (runs once)
const initPromise = initializeAdminFromEnv();

export const handle: Handle = async ({ event, resolve }) => {
	// Ensure initialization completes before handling requests
	await initPromise;

	const sessionId = event.cookies.get('session');
	
	if (sessionId) {
		const user = await validateSession(sessionId);
		if (user) {
			event.locals.user = user;
		} else {
			// Invalid or expired session, clear cookie
			event.cookies.delete('session', { path: '/' });
		}
	}
	
	return resolve(event);
};
