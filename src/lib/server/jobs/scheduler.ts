import cron, { type ScheduledTask } from 'node-cron';
import { scannerService } from '$lib/server/services/scanner';

let initialized = false;
let autoModeTask: ScheduledTask | null = null;
let scanTask: ScheduledTask | null = null;
let filterTask: ScheduledTask | null = null;
let researchTask: ScheduledTask | null = null;

export function initializeJobs() {
	if (initialized) {
		console.log('Jobs already initialized');
		return;
	}
	
	console.log('Initializing background jobs...');
	
	// Scan feeds every 2 hours
	scanTask = cron.schedule('0 */2 * * *', async () => {
		console.log('[Job] Starting feed scan...');
		try {
			await scannerService.scanAllSources();
			console.log('[Job] Feed scan completed');
		} catch (error) {
			console.error('[Job] Feed scan failed:', error);
		}
	});
	
	// Filter pending items every 30 minutes
	filterTask = cron.schedule('*/30 * * * *', async () => {
		console.log('[Job] Starting AI filtering...');
		try {
			await scannerService.filterPendingItems(10);
			console.log('[Job] AI filtering completed');
		} catch (error) {
			console.error('[Job] AI filtering failed:', error);
		}
	});
	
	// Research accepted items every hour
	researchTask = cron.schedule('0 * * * *', async () => {
		console.log('[Job] Starting AI research...');
		try {
			await scannerService.researchAcceptedItems(3);
			console.log('[Job] AI research completed');
		} catch (error) {
			console.error('[Job] AI research failed:', error);
		}
	});
	
	// Auto mode - runs every hour and checks if enabled
	autoModeTask = cron.schedule('0 * * * *', async () => {
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
	});
	
	initialized = true;
	console.log('Background jobs initialized');
}

export function runJobNow(jobName: 'scan' | 'filter' | 'research' | 'auto' | 'discover'): Promise<unknown> {
	switch (jobName) {
		case 'scan':
			return scannerService.scanAllSources();
		case 'filter':
			return scannerService.filterPendingItems(20);
		case 'research':
			return scannerService.researchAcceptedItems(5);
		case 'auto':
			return scannerService.runAutoMode();
		case 'discover':
			return scannerService.runAutonomousDiscovery(3);
		default:
			throw new Error(`Unknown job: ${jobName}`);
	}
}

export function stopJobs() {
	if (scanTask) scanTask.stop();
	if (filterTask) filterTask.stop();
	if (researchTask) researchTask.stop();
	if (autoModeTask) autoModeTask.stop();
	initialized = false;
	console.log('Background jobs stopped');
}
