import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { buildInfo } from '$lib/build-info';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	if (locals.user.role !== 'admin') {
		throw redirect(302, '/');
	}

	// Surface deploy metadata to the admin sidebar (rendered by +layout.svelte).
	// Only exposed inside /admin so we don't leak commit details to anonymous
	// users on the public site.
	return { buildInfo };
};
