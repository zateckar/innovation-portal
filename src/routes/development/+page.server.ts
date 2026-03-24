import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(302, '/auth/login');

	const [devIdeas, settingsRow] = await Promise.all([
		ideasService.getIdeasInDevelopment(locals.user.id),
		db
			.select({ ideaVoteThreshold: settings.ideaVoteThreshold })
			.from(settings)
			.where(eq(settings.id, 'default'))
			.limit(1)
			.then((r) => r[0])
	]);

	return {
		inProgress: devIdeas.inProgress,
		underReview: devIdeas.underReview,
		voteThreshold: settingsRow?.ideaVoteThreshold ?? 5
	};
};
