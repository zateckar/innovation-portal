import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import type { DepartmentCategory } from '$lib/types';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;
	const department = url.searchParams.get('department') as DepartmentCategory | null;
	const search = url.searchParams.get('q');
	const sort = url.searchParams.get('sort') || 'recent';
	
	try {
	const [{ ideas, total }, settingsRow] = await Promise.all([
		ideasService.getPublishedIdeas(
			{
				department: department || undefined,
				search: search || undefined,
				sort,
				limit: 50
			},
			userId
		),
		db.select({ ideaVoteThreshold: settings.ideaVoteThreshold })
			.from(settings)
			.where(eq(settings.id, 'default'))
			.limit(1)
			.then((rows) => rows[0])
	]);
	
	return {
		ideas,
		total,
		filters: {
			department,
			search,
			sort
		},
		voteThreshold: settingsRow?.ideaVoteThreshold ?? 5
	};
	} catch {
		return {
			ideas: [] as Awaited<ReturnType<typeof ideasService.getPublishedIdeas>>['ideas'],
			total: 0,
			filters: { department, search, sort },
			voteThreshold: 5
		};
	}
};
