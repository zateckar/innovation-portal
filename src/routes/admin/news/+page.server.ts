import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { news } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { newsService } from '$lib/server/services/news';
import { runJobNow } from '$lib/server/jobs/scheduler';

export const load: PageServerLoad = async ({ url }) => {
	const department = url.searchParams.get('department') || undefined;
	const status = url.searchParams.get('status') || undefined;
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const limit = 100;
	const offset = (page - 1) * limit;

	const { news: allNews, total } = await newsService.getAllNews({ department, status, limit, offset });

	return { news: allNews, total, page, limit };
};

export const actions: Actions = {
	generate: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const count = await runJobNow('news');
			return { success: true, message: `News generation completed. Generated ${count} articles.` };
		} catch (error) {
			return fail(500, { error: 'News generation failed' });
		}
	},
	publish: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.update(news).set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() }).where(eq(news.id, id));
		return { success: true, message: 'News published' };
	},
	archive: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.update(news).set({ status: 'archived', updatedAt: new Date() }).where(eq(news.id, id));
		return { success: true, message: 'News archived' };
	},
	delete: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.delete(news).where(eq(news.id, id));
		return { success: true, message: 'News deleted' };
	}
};
