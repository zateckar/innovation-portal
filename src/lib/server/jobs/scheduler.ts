import cron, { type ScheduledTask } from 'node-cron';
import { scannerService } from '$lib/server/services/scanner';
import { newsService } from '$lib/server/services/news';
import { ideasService } from '$lib/server/services/ideas';

let initialized = false;
let schedulerTask: ScheduledTask | null = null;

async function runScanJob() {
	console.log('[Job] Checking feed scan...');
	try {
		const shouldRun = await scannerService.shouldRunScan();
		if (!shouldRun) {
			console.log('[Job] Feed scan not due yet, skipping');
			return;
		}
		console.log('[Job] Starting feed scan...');
		await scannerService.scanAllSources();
		await scannerService.updateScanLastRun();
		console.log('[Job] Feed scan completed');
	} catch (error) {
		console.error('[Job] Feed scan failed:', error);
	}
}

async function runFilterJob() {
	console.log('[Job] Checking AI filtering...');
	try {
		const shouldRun = await scannerService.shouldRunFilter();
		if (!shouldRun) {
			console.log('[Job] AI filtering not due yet, skipping');
			return;
		}
		console.log('[Job] Starting AI filtering...');
		await scannerService.filterPendingItems(10);
		await scannerService.updateFilterLastRun();
		console.log('[Job] AI filtering completed');
	} catch (error) {
		console.error('[Job] AI filtering failed:', error);
	}
}

async function runResearchJob() {
	console.log('[Job] Checking AI research...');
	try {
		const shouldRun = await scannerService.shouldRunResearch();
		if (!shouldRun) {
			console.log('[Job] AI research not due yet, skipping');
			return;
		}
		console.log('[Job] Starting AI research...');
		await scannerService.researchAcceptedItems(3);
		await scannerService.updateResearchLastRun();
		console.log('[Job] AI research completed');
	} catch (error) {
		console.error('[Job] AI research failed:', error);
	}
}

async function runAutoModeJob() {
	console.log('[Job] Checking auto mode...');
	try {
		const settings = await scannerService.getSettings();
		if (settings?.autoModeEnabled) {
			console.log('[Job] Running auto mode...');
			await scannerService.runAutoMode();
			console.log('[Job] Auto mode completed');
		} else {
			console.log('[Job] Auto mode is disabled, skipping');
		}
	} catch (error) {
		console.error('[Job] Auto mode failed:', error);
	}
}

async function runArchiveJob() {
	console.log('[Job] Checking auto-archive...');
	try {
		const shouldRun = await scannerService.shouldRunArchive();
		if (!shouldRun) {
			console.log('[Job] Auto-archive not due yet, skipping');
			return;
		}
		console.log('[Job] Running auto-archive...');
		await scannerService.archiveInactiveInnovations();
		await scannerService.updateArchiveLastRun();
		console.log('[Job] Auto-archive completed');
	} catch (error) {
		console.error('[Job] Auto-archive failed:', error);
	}
}

async function runCleanupJob() {
	console.log('[Job] Checking feed cleanup...');
	try {
		const shouldRun = await scannerService.shouldRunCleanup();
		if (!shouldRun) {
			console.log('[Job] Feed cleanup not due yet, skipping');
			return;
		}
		console.log('[Job] Running feed cleanup...');
		await scannerService.cleanupOldFeedItems();
		await scannerService.updateCleanupLastRun();
		console.log('[Job] Feed cleanup completed');
	} catch (error) {
		console.error('[Job] Feed cleanup failed:', error);
	}
}

async function runNewsJob() {
	console.log('[Job] Checking news generation...');
	try {
		const settings = await scannerService.getSettings();
		if (!settings?.newsEnabled) {
			console.log('[Job] News generation is disabled, skipping');
			return;
		}
		
		if (settings.newsLastRunAt) {
			const minutesSinceLastRun = (Date.now() - settings.newsLastRunAt.getTime()) / (1000 * 60);
			if (minutesSinceLastRun < (settings.newsIntervalMinutes || 1440)) {
				console.log('[Job] News generation not due yet, skipping');
				return;
			}
		}
		
		console.log('[Job] Starting news generation...');
		await newsService.generateAndPublishNews();
		console.log('[Job] News generation completed');
	} catch (error) {
		console.error('[Job] News generation failed:', error);
	}
}

async function runIdeasJob() {
	console.log('[Job] Checking ideas generation...');
	try {
		const settings = await scannerService.getSettings();
		if (!settings?.ideasEnabled) {
			console.log('[Job] Ideas generation is disabled, skipping');
			return;
		}
		
		if (settings.ideasLastRunAt) {
			const minutesSinceLastRun = (Date.now() - settings.ideasLastRunAt.getTime()) / (1000 * 60);
			if (minutesSinceLastRun < (settings.ideasIntervalMinutes || 1440)) {
				console.log('[Job] Ideas generation not due yet, skipping');
				return;
			}
		}
		
		console.log('[Job] Starting ideas pipeline...');
		await ideasService.runFullPipeline();
		console.log('[Job] Ideas pipeline completed');
	} catch (error) {
		console.error('[Job] Ideas pipeline failed:', error);
	}
}

async function runJiraJob() {
	console.log('[Job] Checking Jira pipeline...');
	try {
		const settings = await scannerService.getSettings();
		if (!settings?.jiraEnabled) {
			console.log('[Job] Jira integration is disabled, skipping');
			return;
		}

		const shouldRun = await ideasService.shouldRunJira();
		if (!shouldRun) {
			console.log('[Job] Jira pipeline not due yet, skipping');
			return;
		}

		console.log('[Job] Starting Jira pipeline...');
		const result = await ideasService.runJiraPipeline();
		console.log('[Job] Jira pipeline completed:', result);
	} catch (error) {
		console.error('[Job] Jira pipeline failed:', error);
	}
}

async function runScheduledTasks() {
	const settings = await scannerService.getSettings();
	
	if (settings?.autoModeEnabled) {
		console.log('[Scheduler] Auto mode is enabled, running full pipeline...');
		await runAutoModeJob();
	} else {
		console.log('[Scheduler] Auto mode disabled, running individual tasks...');
		await runScanJob();
		await runFilterJob();
		await runResearchJob();
	}
	
	await runArchiveJob();
	await runCleanupJob();
	
	// News and Ideas run independently of auto mode
	await runNewsJob();
	await runIdeasJob();

	// Jira runs independently of auto mode
	await runJiraJob();
}

export function initializeJobs() {
	if (initialized) {
		console.log('Jobs already initialized');
		return;
	}
	
	console.log('Initializing background jobs...');
	
	schedulerTask = cron.schedule('* * * * *', async () => {
		await runScheduledTasks();
	});
	
	initialized = true;
	console.log('Background jobs initialized (runs every minute, checks settings)');
}

export async function runJobNow(jobName: 'scan' | 'filter' | 'research' | 'auto' | 'discover' | 'news' | 'ideas' | 'jira'): Promise<unknown> {
	switch (jobName) {
		case 'scan':
			await scannerService.scanAllSources();
			await scannerService.updateScanLastRun();
			return;
		case 'filter':
			await scannerService.filterPendingItems(20);
			await scannerService.updateFilterLastRun();
			return;
		case 'research':
			await scannerService.researchAcceptedItems(5);
			await scannerService.updateResearchLastRun();
			return;
		case 'auto':
			return scannerService.runAutoMode();
		case 'discover':
			return scannerService.runAutonomousDiscovery(3);
		case 'news':
			return newsService.generateAndPublishNews();
		case 'ideas':
			return ideasService.runFullPipeline();
		case 'jira':
			return ideasService.importFromJira();
		default:
			throw new Error(`Unknown job: ${jobName}`);
	}
}

export function stopJobs() {
	if (schedulerTask) schedulerTask.stop();
	initialized = false;
	console.log('Background jobs stopped');
}
