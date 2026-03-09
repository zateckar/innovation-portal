import type { PageServerLoad } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import type { DepartmentCategory } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user?.id;
	const department = url.searchParams.get('department') as DepartmentCategory | null;
	const search = url.searchParams.get('q');
	const sort = url.searchParams.get('sort') || 'recent';
	
	const { ideas, total } = await ideasService.getPublishedIdeas(
		{
			department: department || undefined,
			search: search || undefined,
			sort,
			limit: 50
		},
		userId
	);
	
	return {
		ideas,
		total,
		filters: {
			department,
			search,
			sort
		}
	};
};
