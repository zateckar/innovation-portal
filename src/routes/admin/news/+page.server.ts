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

	const allNews = await newsService.getAllNews({ department, status });

	return { news: allNews };
};

export const actions: Actions = {
	generate: async () => {
		try {
			const count = await runJobNow('news');
			return { success: true, message: `News generation completed. Generated ${count} articles.` };
		} catch (error) {
			return fail(500, { error: 'News generation failed' });
		}
	},
	publish: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.update(news).set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() }).where(eq(news.id, id));
		return { success: true, message: 'News published' };
	},
	archive: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.update(news).set({ status: 'archived', updatedAt: new Date() }).where(eq(news.id, id));
		return { success: true, message: 'News archived' };
	},
	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.delete(news).where(eq(news.id, id));
		return { success: true, message: 'News deleted' };
	}
};
