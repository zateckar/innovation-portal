import { scannerService } from '$lib/server/services/scanner';
import { newsService } from '$lib/server/services/news';
import { ideasService } from '$lib/server/services/ideas';
import { trendsService } from '$lib/server/services/trends';
import { cleanupExpiredSessions } from '$lib/server/services/auth';

let initialized = false;
let schedulerTask: { stop(): void } | null = null;

// Guard against concurrent scheduler executions (e.g. a job taking longer than 5 minutes)
let isRunning = false;

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
		if (!settings?.autoModeEnabled) {
			console.log('[Job] Auto mode is disabled, skipping');
			return;
		}

		// Enforce interval using a dedicated autoModeLastRunAt timestamp so that
		// manually-triggered scans (which update scanLastRunAt) do not accidentally
		// reset the auto-mode cooldown.
		if (settings.autoModeLastRunAt) {
			const minutesSinceLastRun = (Date.now() - settings.autoModeLastRunAt.getTime()) / (1000 * 60);
			const interval = settings.autoRunIntervalMinutes ?? 60;
			if (minutesSinceLastRun < interval) {
				console.log(`[Job] Auto mode not due yet (${Math.floor(minutesSinceLastRun)}/${interval} min elapsed), skipping`);
				return;
			}
		}

		console.log('[Job] Running auto mode...');
		await scannerService.runAutoMode();
		await scannerService.updateAutoModeLastRun();
		console.log('[Job] Auto mode completed');
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

async function runTrendsJob() {
	console.log('[Job] Checking trends generation...');
	try {
		const settings = await scannerService.getSettings();
		if (!settings?.trendsEnabled) {
			console.log('[Job] Trends generation is disabled, skipping');
			return;
		}

		if (settings.trendsLastRunAt) {
			const minutesSinceLastRun = (Date.now() - settings.trendsLastRunAt.getTime()) / (1000 * 60);
			if (minutesSinceLastRun < (settings.trendsIntervalMinutes || 10080)) {
				console.log('[Job] Trends generation not due yet, skipping');
				return;
			}
		}

		console.log('[Job] Starting trends generation...');
		await trendsService.generateAndPublishTrends();
		console.log('[Job] Trends generation completed');
	} catch (error) {
		console.error('[Job] Trends generation failed:', error);
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

// ─── Settings cache to reduce per-tick DB queries ────────────────────────────
// A shallow cache so the every-minute cron tick does not hit the DB when all
// jobs are disabled. Invalidated whenever settings are updated.
let cachedSettingsForScheduler: Awaited<ReturnType<typeof scannerService.getSettings>> | null = null;
let cachedSettingsAt = 0;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getSchedulerSettings() {
	if (cachedSettingsForScheduler && Date.now() - cachedSettingsAt < SETTINGS_CACHE_TTL_MS) {
		return cachedSettingsForScheduler;
	}
	cachedSettingsForScheduler = await scannerService.getSettings();
	cachedSettingsAt = Date.now();
	return cachedSettingsForScheduler;
}

// Watchdog: if any job batch takes longer than 30 minutes, force-reset isRunning
// so subsequent cron ticks are not permanently blocked.
const WATCHDOG_TIMEOUT_MS = 30 * 60 * 1000;

async function runScheduledTasks() {
	// Prevent concurrent execution: if previous tick is still running, skip this tick
	if (isRunning) {
		console.log('[Scheduler] Previous run still in progress, skipping this tick');
		return;
	}

	isRunning = true;
	const watchdog = setTimeout(() => {
		console.error('[Scheduler] Watchdog timeout: job batch exceeded 30 minutes. Forcing isRunning = false.');
		isRunning = false;
	}, WATCHDOG_TIMEOUT_MS);

	try {
		const settings = await getSchedulerSettings();
		// Invalidate cache after reading so next tick gets fresh settings
		cachedSettingsForScheduler = null;

		if (settings?.autoModeEnabled) {
			// Auto mode handles scan/filter/research internally with its own interval check
			console.log('[Scheduler] Auto mode is enabled, checking auto mode pipeline...');
			await runAutoModeJob();
		} else {
			// Individual scan/filter/research jobs — each has its own interval check
			console.log('[Scheduler] Auto mode disabled, running individual tasks...');
			await runScanJob();
			await runFilterJob();
			await runResearchJob();
		}

		// These always run independently of auto mode, each with their own interval checks
		await runArchiveJob();
		await runCleanupJob();

		// News, Ideas, Jira and Trends run independently of auto mode
		await runNewsJob();
		await runIdeasJob();
		await runJiraJob();
		await runTrendsJob();

		// Clean up expired sessions (runs every tick, cheap query)
		await cleanupExpiredSessions().catch((err) =>
			console.error('[Job] Session cleanup failed:', err)
		);
	} finally {
		clearTimeout(watchdog);
		isRunning = false;
	}
}

export function initializeJobs() {
	if (initialized) {
		console.log('Jobs already initialized');
		return;
	}

	console.log('Initializing background jobs...');

	schedulerTask = Bun.cron('*/5 * * * *', async () => {
		await runScheduledTasks();
	}) as unknown as { stop(): void };

	initialized = true;
	console.log('Background jobs initialized (runs every 5 minutes, checks settings)');
}

export async function runJobNow(jobName: 'scan' | 'filter' | 'research' | 'auto' | 'discover' | 'news' | 'ideas' | 'jira' | 'trends'): Promise<unknown> {
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
		case 'trends':
			return trendsService.generateAndPublishTrends();
		default:
			throw new Error(`Unknown job: ${jobName}`);
	}
}

export function stopJobs() {
	if (schedulerTask) schedulerTask.stop();
	schedulerTask = null;
	initialized = false;
	// Reset the concurrency guard so re-initialization is not permanently blocked
	// if stopJobs() was called while a job batch was mid-execution.
	isRunning = false;
	cachedSettingsForScheduler = null;
	console.log('Background jobs stopped');
}
