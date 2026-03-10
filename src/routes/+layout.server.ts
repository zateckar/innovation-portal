import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		return { user: undefined };
	}

	// Omit accessToken — it is a server-side OIDC credential and must not be
	// serialised into the client-side page data.
	const { accessToken: _, ...publicUser } = locals.user;

	return {
		user: publicUser
	};
};
