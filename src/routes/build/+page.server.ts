import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { ideasService } from '$lib/server/services/ideas';
import type { DepartmentCategory, IdeaSummary } from '$lib/types';
import { DEPARTMENTS } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;

	const deptParam = url.searchParams.get('dept');
	const activeDept: DepartmentCategory | null =
		deptParam && (DEPARTMENTS as readonly string[]).includes(deptParam)
			? (deptParam as DepartmentCategory)
			: (locals.user.department as DepartmentCategory | null) ?? null;

	const matchesDept = (i: IdeaSummary) => !activeDept || i.department === activeDept;

	try {
		const [{ ideas: userIdeas, total: userIdeasCount }, devBuckets] = await Promise.all([
			ideasService.getPublishedIdeas(
				{
					department: activeDept ?? undefined,
					source: 'user',
					sort: 'votes',
					limit: 6
				},
				userId
			),
			ideasService.getIdeasInDevelopment(userId)
		]);

		// Department-scope the development snapshot to match the active filter.
		const inProgress = devBuckets.inProgress.filter(matchesDept);
		const underReview = devBuckets.underReview.filter(matchesDept);
		const building = devBuckets.building.filter(matchesDept);
		const deployed = devBuckets.deployed.filter(matchesDept);

		const devItems = [...building, ...inProgress, ...underReview, ...deployed].slice(0, 6);
		const devCounts = {
			inProgress: inProgress.length,
			underReview: underReview.length,
			building: building.length,
			deployed: deployed.length,
			total: inProgress.length + underReview.length + building.length + deployed.length
		};

		return { activeDept, userIdeas, userIdeasCount, devItems, devCounts };
	} catch (err) {
		console.error('[Build] Load failed:', err);
		return {
			activeDept,
			userIdeas: [] as IdeaSummary[],
			userIdeasCount: 0,
			devItems: [] as IdeaSummary[],
			devCounts: { inProgress: 0, underReview: 0, building: 0, deployed: 0, total: 0 }
		};
	}
};

export const actions: Actions = {
	setDepartment: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/auth/login');
		}
		const formData = await request.formData();
		const dept = formData.get('dept') as string | null;
		const newDept =
			dept && (DEPARTMENTS as readonly string[]).includes(dept) ? (dept as DepartmentCategory) : null;

		try {
			await db.update(users).set({ department: newDept }).where(eq(users.id, locals.user.id));
		} catch {
			// ignore
		}

		throw redirect(303, '/build');
	}
};
