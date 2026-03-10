import type { PageServerLoad } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;
	const idea = await ideasService.getIdeaBySlug(params.slug, userId);
	
	if (!idea) {
		throw redirect(302, `${base}/ideas`);
	}
	
	return {
		idea
	};
};
