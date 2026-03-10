import type { PageServerLoad, Actions } from './$types';
import { db, settings } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { scannerService } from '$lib/server/services/scanner';
import { runJobNow } from '$lib/server/jobs/scheduler';

type SchedulerJob = Parameters<typeof runJobNow>[0];

export const load: PageServerLoad = async () => {
	const currentSettings = await scannerService.ensureSettings();
	return { settings: currentSettings };
};

export const actions: Actions = {
	saveSchedule: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();

		// Auto mode
		const autoModeEnabled = formData.get('autoModeEnabled') === 'on';
		const autoRunIntervalMinutes = parseInt(formData.get('autoRunIntervalMinutes') as string) || 60;
		const autoPublishThreshold = parseFloat(formData.get('autoPublishThreshold') as string) || 7.0;
		const autoInnovationsPerRun = parseInt(formData.get('autoInnovationsPerRun') as string) || 3;

		// Scan
		const scanEnabled = formData.get('scanEnabled') === 'on';
		const scanIntervalMinutes = parseInt(formData.get('scanIntervalMinutes') as string) || 120;

		// Filter
		const filterEnabled = formData.get('filterEnabled') === 'on';
		const filterIntervalMinutes = parseInt(formData.get('filterIntervalMinutes') as string) || 30;

		// Research
		const researchEnabled = formData.get('researchEnabled') === 'on';

		// Archive
		const archiveEnabled = formData.get('archiveEnabled') === 'on';
		const archiveNoVotesDays = parseInt(formData.get('archiveNoVotesDays') as string) || 14;

		// Cleanup
		const cleanupEnabled = formData.get('cleanupEnabled') === 'on';
		const cleanupOlderThanDays = parseInt(formData.get('cleanupOlderThanDays') as string) || 7;

		// News
		const newsEnabled = formData.get('newsEnabled') === 'on';
		const newsIntervalMinutes = parseInt(formData.get('newsIntervalMinutes') as string) || 1440;
		const newsDepartments = JSON.stringify(formData.getAll('newsDepartments'));

		// Ideas
		const ideasEnabled = formData.get('ideasEnabled') === 'on';
		const ideasIntervalMinutes = parseInt(formData.get('ideasIntervalMinutes') as string) || 1440;
		const ideasPerBatch = parseInt(formData.get('ideasPerBatch') as string) || 5;
		const ideasAutoRealize = formData.get('ideasAutoRealize') === 'on';
		const ideasDepartments = JSON.stringify(formData.getAll('ideasDepartments'));

		// Jira
		const jiraEnabled = formData.get('jiraEnabled') === 'on';
		const jiraIntervalMinutes = parseInt(formData.get('jiraIntervalMinutes') as string) || 1440;
		const jiraMaxIssuesPerRun = parseInt(formData.get('jiraMaxIssuesPerRun') as string) || 20;

		if (autoPublishThreshold < 1 || autoPublishThreshold > 10) {
			return fail(400, { error: 'Auto-publish threshold must be between 1 and 10' });
		}
		if (autoInnovationsPerRun < 1 || autoInnovationsPerRun > 20) {
			return fail(400, { error: 'Innovations per run must be between 1 and 20' });
		}

		try {
			await db.update(settings)
				.set({
					autoModeEnabled,
					autoRunIntervalMinutes,
					autoPublishThreshold,
					autoInnovationsPerRun,
					scanEnabled,
					scanIntervalMinutes,
					filterEnabled,
					filterIntervalMinutes,
					researchEnabled,
					archiveEnabled,
					archiveNoVotesDays,
					cleanupEnabled,
					cleanupOlderThanDays,
					newsEnabled,
					newsIntervalMinutes,
					newsDepartments,
					ideasEnabled,
					ideasIntervalMinutes,
					ideasPerBatch,
					ideasAutoRealize,
					ideasDepartments,
					jiraEnabled,
					jiraIntervalMinutes,
					jiraMaxIssuesPerRun,
					updatedAt: new Date()
				})
				.where(eq(settings.id, 'default'));

			const updatedSettings = await scannerService.ensureSettings();
			return { success: true, message: 'Schedule saved', settings: updatedSettings };
		} catch (error) {
			console.error('Error saving schedule:', error);
			return fail(500, { error: 'Failed to save schedule' });
		}
	},

	runJob: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const job = formData.get('job') as string;

		try {
			// Archive and cleanup are not in runJobNow — call scanner service directly
			if (job === 'archive') {
				await scannerService.archiveInactiveInnovations();
				await scannerService.updateArchiveLastRun();
				return { success: true, message: 'Auto-archive completed' };
			}
			if (job === 'cleanup') {
				await scannerService.cleanupOldFeedItems();
				await scannerService.updateCleanupLastRun();
				return { success: true, message: 'Feed cleanup completed' };
			}

			const schedulerJobs: SchedulerJob[] = ['auto', 'discover', 'scan', 'filter', 'research', 'news', 'ideas', 'jira'];
			if (!schedulerJobs.includes(job as SchedulerJob)) {
				return fail(400, { error: 'Invalid job name' });
			}

			const result = await runJobNow(job as SchedulerJob);
			return { success: true, message: `Job "${job}" completed`, result: JSON.stringify(result) };
		} catch (error) {
			console.error(`Error running job ${job}:`, error);
			return fail(500, { error: `Job "${job}" failed` });
		}
	}
};
