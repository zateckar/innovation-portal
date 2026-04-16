import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { trends } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { trendsService } from '$lib/server/services/trends';
import { runJobNow } from '$lib/server/jobs/scheduler';

export const load: PageServerLoad = async ({ url }) => {
	const categoryGroup = url.searchParams.get('group') || undefined;
	const status = url.searchParams.get('status') || undefined;
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const limit = 100;
	const offset = (page - 1) * limit;

	try {
		const { trends: allTrends, total } = await trendsService.getAllTrends({
			categoryGroup,
			status,
			limit,
			offset
		});

		return { trends: allTrends, total, page, limit };
	} catch {
		return { trends: [], total: 0, page, limit };
	}
};

export const actions: Actions = {
	generate: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const count = await runJobNow('trends');
			return { success: true, message: `Trends generation completed. Generated ${count} trend analyses.` };
		} catch (error) {
			console.error('Trends generation failed:', error);
			return fail(500, { error: 'Trends generation failed' });
		}
	},
	publish: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		try {
			await db.update(trends).set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() }).where(eq(trends.id, id));
			return { success: true, message: 'Trend published' };
		} catch {
			return fail(500, { error: 'Failed to publish trend' });
		}
	},
	archive: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		try {
			await db.update(trends).set({ status: 'archived', updatedAt: new Date() }).where(eq(trends.id, id));
			return { success: true, message: 'Trend archived' };
		} catch {
			return fail(500, { error: 'Failed to archive trend' });
		}
	},
	delete: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		try {
			await db.delete(trends).where(eq(trends.id, id));
			return { success: true, message: 'Trend deleted' };
		} catch {
			return fail(500, { error: 'Failed to delete trend' });
		}
	}
};
