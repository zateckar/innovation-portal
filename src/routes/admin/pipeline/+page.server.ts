import type { PageServerLoad, Actions } from './$types';
import { runJobNow } from '$lib/server/jobs/scheduler';
import { scannerService } from '$lib/server/services/scanner';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	const settings = await scannerService.ensureSettings();
	return { settings };
};

export const actions: Actions = {
	runAutoMode: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('auto');
			return { success: true, message: `Auto mode completed: ${JSON.stringify(result)}` };
		} catch {
			return fail(500, { error: 'Auto mode failed' });
		}
	},

	runDiscover: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('discover');
			return { success: true, message: `Discovery completed: ${JSON.stringify(result)}` };
		} catch {
			return fail(500, { error: 'Discovery failed' });
		}
	},

	runJira: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('jira');
			return { success: true, message: `Jira pipeline completed: ${JSON.stringify(result)}` };
		} catch {
			return fail(500, { error: 'Jira pipeline failed' });
		}
	},

	runScan: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			await runJobNow('scan');
			return { success: true, message: 'Feed scan completed' };
		} catch {
			return fail(500, { error: 'Scan failed' });
		}
	},

	runFilter: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('filter');
			return { success: true, message: `AI filtering completed: ${JSON.stringify(result)}` };
		} catch {
			return fail(500, { error: 'Filtering failed' });
		}
	},

	runResearch: async ({ locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const result = await runJobNow('research');
			return { success: true, message: `AI research completed: ${JSON.stringify(result)}` };
		} catch {
			return fail(500, { error: 'Research failed' });
		}
	}
};
