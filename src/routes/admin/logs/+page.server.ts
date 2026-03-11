import type { PageServerLoad } from './$types';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';

export const load: PageServerLoad = async ({ url }) => {
	const logFile = process.env.LOG_FILE || 'server.log';
	const logPath = join(process.cwd(), logFile);
	const logDir = dirname(logPath);
	const logBaseName = basename(logPath);

	let logs: string[] = [];
	let logExists = false;

	if (existsSync(logPath)) {
		logExists = true;
		try {
			const content = readFileSync(logPath, 'utf-8');
			logs = content.split('\n').filter((line) => line.trim());
		} catch (e) {
			console.error('Error reading log file:', e);
		}
	}

	// Get the last N lines (default 500, max 5000)
	const MAX_LIMIT = 5000;
	const limit = Math.min(
		Math.max(1, parseInt(url.searchParams.get('limit') || '500') || 500),
		MAX_LIMIT
	);

	// Level filter: error, warn, info, debug (default: show all)
	const levelFilter = url.searchParams.get('level') || 'all';
	let filteredLogs = logs;
	if (levelFilter !== 'all') {
		const upper = levelFilter.toUpperCase();
		filteredLogs = logs.filter((line) => line.includes(`[${upper}]`));
	}

	const pagedLogs = filteredLogs.slice(-limit).reverse();

	// List available rotated log files for navigation
	let rotatedFiles: string[] = [];
	try {
		if (existsSync(logDir)) {
			const prefix = logBaseName.slice(0, logBaseName.lastIndexOf('.') !== -1 ? logBaseName.lastIndexOf('.') : undefined);
			const suffix = logBaseName.slice(logBaseName.lastIndexOf('.') !== -1 ? logBaseName.lastIndexOf('.') : logBaseName.length);
			rotatedFiles = readdirSync(logDir)
				.filter((f: string) => f !== logBaseName && f.startsWith(prefix) && f.endsWith(suffix))
				.sort()
				.reverse(); // newest first
		}
	} catch {
		// ignore
	}

	return {
		logs: pagedLogs,
		logExists,
		logFile,
		totalLines: filteredLogs.length,
		levelFilter,
		rotatedFiles
	};
};
