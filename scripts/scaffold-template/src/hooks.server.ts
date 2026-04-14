import type { Handle } from '@sveltejs/kit';

/**
 * Read the authenticated user identity forwarded by the main-app proxy.
 *
 * The proxy (innovation-incubator-opus) validates the main-app session before
 * forwarding requests here, then sets these trusted headers:
 *   x-user-id         — stable user ID
 *   x-user-email      — user email address
 *   x-user-name       — display name
 *   x-user-role       — "user" | "admin"
 *   x-user-department — department slug (may be empty)
 *
 * Every route can access the current user via event.locals.user.
 * Do NOT implement your own auth — the user is always authenticated here.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const headers = event.request.headers;

	event.locals.user = {
		id: headers.get('x-user-id') ?? 'anonymous',
		email: headers.get('x-user-email') ?? '',
		name: headers.get('x-user-name') ?? 'Unknown',
		role: headers.get('x-user-role') ?? 'user',
		department: headers.get('x-user-department') ?? ''
	};

	return resolve(event);
};
