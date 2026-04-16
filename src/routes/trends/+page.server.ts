import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { trendsService } from '$lib/server/services/trends';
import type { TrendSummary, TrendCategoryGroup, TrendMaturityLevel, TrendTimeHorizon } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const categoryGroup = url.searchParams.get('group') as TrendCategoryGroup | null;
	const search = url.searchParams.get('q');

	try {
		const trendsData = await trendsService.getPublishedTrends({
			categoryGroup: categoryGroup || undefined,
			search: search || undefined
		});

		const trendsList: TrendSummary[] = trendsData.map(item => ({
			id: item.id,
			slug: item.slug,
			category: item.category,
			categoryGroup: item.categoryGroup as TrendCategoryGroup,
			title: item.title,
			summary: item.summary,
			maturityLevel: item.maturityLevel as TrendMaturityLevel | null,
			impactScore: item.impactScore,
			timeHorizon: item.timeHorizon as TrendTimeHorizon | null,
			publishedAt: item.publishedAt,
			createdAt: item.createdAt
		}));

		return {
			trends: trendsList,
			filters: {
				categoryGroup,
				search
			}
		};
	} catch {
		return {
			trends: [] as TrendSummary[],
			filters: { categoryGroup, search }
		};
	}
};
