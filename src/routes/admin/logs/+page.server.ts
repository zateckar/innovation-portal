import type { PageServerLoad } from './$types';
import { openSync, fstatSync, readSync, closeSync, existsSync, readdirSync } from 'fs';
import { dirname, basename } from 'path';
import { logPath, logFile, getLogLevel } from '$lib/server/logger';

// Maximum bytes to read from the tail of the log file per request.
// Avoids loading the entire file into memory when it grows large.
const MAX_READ_BYTES = 512 * 1024; // 512 KB

const VALID_LEVELS = ['all', 'debug', 'info', 'warn', 'error'] as const;
type LevelFilter = (typeof VALID_LEVELS)[number];

export const load: PageServerLoad = async ({ url }) => {
	const logDir = dirname(logPath);
	const logBaseName = basename(logPath);
	const activeLogLevel = getLogLevel();

	let logs: string[] = [];
	let logExists = false;

	if (existsSync(logPath)) {
		logExists = true;
		try {
			// Read only the tail of the log file to avoid blocking the event loop
			// with a full synchronous read of potentially hundreds of megabytes.
			const fd = openSync(logPath, 'r');
			try {
				const { size } = fstatSync(fd);
				const offset = Math.max(0, size - MAX_READ_BYTES);
				const bytesToRead = size - offset;
				const buf = Buffer.allocUnsafe(bytesToRead);
				readSync(fd, buf, 0, bytesToRead, offset);
				const content = buf.toString('utf-8');
				// If we started mid-line, drop the incomplete first line
				const firstNewline = offset > 0 ? content.indexOf('\n') : -1;
				logs = (firstNewline !== -1 ? content.slice(firstNewline + 1) : content)
					.split('\n')
					.filter((line) => line.trim());
			} finally {
				closeSync(fd);
			}
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

	// Validate levelFilter against a whitelist to prevent unexpected filter behavior
	const rawLevel = url.searchParams.get('level') || 'all';
	const levelFilter: LevelFilter = (VALID_LEVELS as readonly string[]).includes(rawLevel)
		? (rawLevel as LevelFilter)
		: 'all';

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
			const dotIdx = logBaseName.lastIndexOf('.');
			const prefix = dotIdx !== -1 ? logBaseName.slice(0, dotIdx) : logBaseName;
			const suffix = dotIdx !== -1 ? logBaseName.slice(dotIdx) : '';
			rotatedFiles = readdirSync(logDir)
				.filter((f: string) => f !== logBaseName && f.startsWith(prefix) && (suffix === '' || f.endsWith(suffix)))
				.sort()
				.reverse(); // newest first
		}
	} catch {
		// ignore
	}

	return {
		logs: pagedLogs,
		logExists,
		// Only expose the human-readable configured path (not the resolved absolute path)
		logFile,
		activeLogLevel,
		totalLines: filteredLogs.length,
		levelFilter,
		rotatedFiles
	};
};
