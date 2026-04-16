import type { PageServerLoad } from './$types';
import { trendsService } from '$lib/server/services/trends';
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { TrendDetail, TrendCategoryGroup, TrendMaturityLevel, TrendTimeHorizon, TrendVisualData } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	try {
		const item = await trendsService.getTrendBySlug(params.slug);

		if (!item) {
			throw redirect(302, `${base}/trends`);
		}

		// Parse JSON fields
		let keyInsights: string[] = [];
		try {
			const parsed = JSON.parse(item.keyInsights || '[]');
			if (Array.isArray(parsed)) keyInsights = parsed;
		} catch { /* ignore */ }

		let visualData: TrendVisualData | null = null;
		try {
			const parsed = JSON.parse(item.visualData || 'null');
			if (parsed && typeof parsed === 'object') visualData = parsed;
		} catch { /* ignore */ }

		let sources: { url: string; title?: string }[] = [];
		try {
			const parsed = JSON.parse(item.sources || '[]');
			if (Array.isArray(parsed)) {
				sources = parsed.map((s: unknown) => {
					if (typeof s === 'string') return { url: s };
					return s as { url: string; title?: string };
				});
			}
		} catch { /* ignore */ }

		const trendDetail: TrendDetail = {
			id: item.id,
			slug: item.slug,
			category: item.category,
			categoryGroup: item.categoryGroup as TrendCategoryGroup,
			title: item.title,
			summary: item.summary,
			content: item.content,
			maturityLevel: item.maturityLevel as TrendMaturityLevel | null,
			impactScore: item.impactScore,
			timeHorizon: item.timeHorizon as TrendTimeHorizon | null,
			publishedAt: item.publishedAt,
			createdAt: item.createdAt,
			keyInsights,
			visualData,
			sources
		};

		return {
			trend: trendDetail
		};
	} catch (e) {
		if (e && typeof e === 'object' && 'location' in e) throw e; // redirect
		throw redirect(302, `${base}/trends`);
	}
};
