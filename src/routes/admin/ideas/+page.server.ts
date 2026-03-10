import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { ideasService } from '$lib/server/services/ideas';
import { runJobNow } from '$lib/server/jobs/scheduler';
import { jiraService } from '$lib/server/services/jira';

export const load: PageServerLoad = async ({ url }) => {
	const department = url.searchParams.get('department') || undefined;
	const status = url.searchParams.get('status') || undefined;
	const batchId = url.searchParams.get('batchId') || undefined;
	const source = url.searchParams.get('source') || undefined;

	const allIdeas = await ideasService.getAllIdeas({ department, status, batchId, source });

	return { ideas: allIdeas };
};

export const actions: Actions = {
	generate: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('ideas');
			return { success: true, message: `Ideas pipeline completed: ${JSON.stringify(result)}` };
		} catch (error) {
			return fail(500, { error: 'Ideas generation failed' });
		}
	},
	evaluate: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const batchId = formData.get('batchId') as string;
		if (!batchId) return fail(400, { error: 'Batch ID required' });

		try {
			const result = await ideasService.evaluateBatch(batchId);
			return { success: true, message: `Evaluated ${result.evaluated} ideas` };
		} catch (error) {
			return fail(500, { error: 'Evaluation failed' });
		}
	},
	realize: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const batchId = formData.get('batchId') as string;
		if (!batchId) return fail(400, { error: 'Batch ID required' });

		try {
			const result = await ideasService.realizeTopIdea(batchId);
			return { success: true, message: result ? `Realized: ${result.title}` : 'No idea to realize' };
		} catch (error) {
			return fail(500, { error: 'Realization failed' });
		}
	},
	publish: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.update(ideas).set({ status: 'published', updatedAt: new Date() }).where(eq(ideas.id, id));
		return { success: true, message: 'Idea published' };
	},
	archive: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.update(ideas).set({ status: 'archived', updatedAt: new Date() }).where(eq(ideas.id, id));
		return { success: true, message: 'Idea archived' };
	},
	delete: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'ID required' });

		await db.delete(ideas).where(eq(ideas.id, id));
		return { success: true, message: 'Idea deleted' };
	},
	importJira: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			// Verify Jira is configured before running
			const credentials = await jiraService.getCredentials();
			if (!credentials) {
				return fail(400, { error: 'Jira is not configured. Please configure Jira in Settings first.' });
			}
			const result = await runJobNow('jira');
			const r = result as { imported?: number; evaluated?: number; realized?: number; published?: number };
			return {
				success: true,
				message: `Jira import complete: ${r.imported ?? 0} imported, ${r.evaluated ?? 0} evaluated, ${r.realized ?? 0} realized, ${r.published ?? 0} published`
			};
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			return fail(500, { error: `Jira import failed: ${msg}` });
		}
	}
};
