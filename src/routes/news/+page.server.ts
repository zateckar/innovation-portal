import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { newsService } from '$lib/server/services/news';
import type { NewsSummary, DepartmentCategory } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const department = url.searchParams.get('department') as DepartmentCategory | null;
	const search = url.searchParams.get('q');
	
	try {
	const newsData = await newsService.getPublishedNews({
		department: department || undefined,
		search: search || undefined
	});
	
	const newsList: NewsSummary[] = newsData.map(item => ({
		id: item.id,
		slug: item.slug,
		title: item.title,
		summary: item.summary,
		category: item.category as DepartmentCategory,
		relevanceScore: item.relevanceScore,
		publishedAt: item.publishedAt,
		createdAt: item.createdAt
	}));
	
	return {
		news: newsList,
		filters: {
			department,
			search
		}
	};
	} catch {
		return {
			news: [] as NewsSummary[],
			filters: { department, search }
		};
	}
};
