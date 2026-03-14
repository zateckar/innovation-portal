import type { PageServerLoad } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;
	const idea = await ideasService.getIdeaBySlug(params.slug, userId);
	
	if (!idea) {
		throw redirect(302, `${base}/ideas`);
	}

	const [settingsRow] = await db
		.select({ ideaVoteThreshold: settings.ideaVoteThreshold, jiraWebHostname: settings.jiraWebHostname })
		.from(settings)
		.where(eq(settings.id, 'default'))
		.limit(1);
	
	return {
		idea,
		voteThreshold: settingsRow?.ideaVoteThreshold ?? 5,
		jiraWebHostname: settingsRow?.jiraWebHostname ?? null
	};
};
