import type { PageServerLoad } from './$types';
import { newsService } from '$lib/server/services/news';
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import type { NewsDetail, DepartmentCategory } from '$lib/types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	try {
	const item = await newsService.getNewsBySlug(params.slug);
	
	if (!item) {
		throw redirect(302, `${base}/news`);
	}
	
	// Parse sources from JSON string
	let sources: { url: string; title?: string }[] = [];
	try {
		const parsed = JSON.parse(item.sources || '[]');
		if (Array.isArray(parsed)) {
			sources = parsed.map((s: unknown) => {
				if (typeof s === 'string') {
					return { url: s };
				}
				return s as { url: string; title?: string };
			});
		}
	} catch {
		// ignore parse errors
	}
	
	const newsDetail: NewsDetail = {
		id: item.id,
		slug: item.slug,
		title: item.title,
		summary: item.summary,
		content: item.content,
		category: item.category as DepartmentCategory,
		relevanceScore: item.relevanceScore,
		publishedAt: item.publishedAt,
		createdAt: item.createdAt,
		sources
	};
	
	return {
		newsItem: newsDetail
	};
	} catch (e) {
		if (e && typeof e === 'object' && 'location' in e) throw e; // redirect
		throw redirect(302, `${base}/news`);
	}
};
