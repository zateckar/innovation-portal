/**
 * Workspace Runtime Log Service
 *
 * Reads, parses, and queries runtime logs from workspace MVP processes.
 * Runtime logs are written by the workspaceProcessManager to:
 *   workspaces/{uuid}/versions/v{N}/runtime.log
 *
 * Provides:
 * - Log reading with pagination and filtering
 * - Structured error extraction from runtime output
 * - Health event history
 */

import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { getRuntimeLogPath } from './workspaceProcessManager';

const WORKSPACES_ROOT = resolve('workspaces');

// Maximum number of rotated logs to keep per version
const MAX_ROTATED_LOGS = 3;

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface RuntimeLogEntry {
	timestamp: string;
	level: 'OUT' | 'ERR';
	message: string;
}

export interface RuntimeError {
	timestamp: string;
	file?: string;
	line?: number;
	message: string;
	category: 'crash' | 'uncaught' | 'unhandled' | 'runtime' | 'network' | 'database' | 'unknown';
}

export interface RuntimeLogSummary {
	totalLines: number;
	errorCount: number;
	lastActivity: string | null;
	errors: RuntimeError[];
	recentLogs: RuntimeLogEntry[];
	logFileSize: number;
}

// ────────────────────────────────────────────────────────────────
// Log Reading
// ────────────────────────────────────────────────────────────────

/**
 * Read runtime log entries for a workspace version.
 * Returns the last `limit` entries, optionally filtered by level.
 */
export function readRuntimeLogs(
	uuid: string,
	version: number,
	options: {
		limit?: number;
		level?: 'OUT' | 'ERR' | 'all';
		since?: string; // ISO timestamp
	} = {}
): RuntimeLogEntry[] {
	const { limit = 200, level = 'all', since } = options;
	const logPath = getRuntimeLogPath(uuid, version);

	if (!existsSync(logPath)) return [];

	try {
		const content = readFileSync(logPath, 'utf-8');
		const lines = content.split('\n').filter(Boolean);

		let entries: RuntimeLogEntry[] = [];

		for (const line of lines) {
			const match = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]\s+\[(OUT|ERR)\]\s+(.*)/);
			if (match) {
				const entry: RuntimeLogEntry = {
					timestamp: match[1],
					level: match[2] as 'OUT' | 'ERR',
					message: match[3]
				};

				// Filter by level
				if (level !== 'all' && entry.level !== level) continue;

				// Filter by time
				if (since && entry.timestamp < since) continue;

				entries.push(entry);
			}
		}

		// Return only the last `limit` entries
		return entries.slice(-limit);
	} catch {
		return [];
	}
}

// ────────────────────────────────────────────────────────────────
// Error Extraction
// ────────────────────────────────────────────────────────────────

/**
 * Error detection patterns for runtime logs.
 * Each pattern has a regex and a category classification.
 */
const ERROR_PATTERNS: Array<{
	regex: RegExp;
	category: RuntimeError['category'];
	extractFile?: boolean;
}> = [
	// Process crash / exit
	{ regex: /Process exited with code (\d+)/, category: 'crash' },

	// Uncaught exceptions
	{ regex: /(?:uncaught|unhandled)\s*(?:exception|error)/i, category: 'uncaught' },
	{ regex: /^\s*at\s+.+\((.+):(\d+):\d+\)/, category: 'uncaught', extractFile: true },

	// Unhandled promise rejections
	{ regex: /unhandled\s*promise\s*rejection/i, category: 'unhandled' },

	// Node.js fatal errors
	{ regex: /FATAL\s+ERROR/i, category: 'crash' },
	{ regex: /JavaScript\s+heap\s+out\s+of\s+memory/i, category: 'crash' },
	{ regex: /Segmentation\s+fault/i, category: 'crash' },

	// Runtime errors (generic Error: ...)
	{ regex: /^Error:\s+(.+)/, category: 'runtime' },
	{ regex: /TypeError:\s+(.+)/, category: 'runtime' },
	{ regex: /ReferenceError:\s+(.+)/, category: 'runtime' },
	{ regex: /SyntaxError:\s+(.+)/, category: 'runtime' },
	{ regex: /RangeError:\s+(.+)/, category: 'runtime' },

	// Database errors
	{ regex: /SQLITE_ERROR/i, category: 'database' },
	{ regex: /SqliteError/i, category: 'database' },
	{ regex: /database\s+is\s+locked/i, category: 'database' },
	{ regex: /no\s+such\s+table/i, category: 'database' },
	{ regex: /UNIQUE\s+constraint\s+failed/i, category: 'database' },

	// Network errors
	{ regex: /ECONNREFUSED/i, category: 'network' },
	{ regex: /EADDRINUSE/i, category: 'network' },
	{ regex: /ETIMEDOUT/i, category: 'network' },
	{ regex: /fetch\s+failed/i, category: 'network' }
];

/**
 * Extract structured errors from runtime log entries.
 * Deduplicates by message content.
 */
export function extractRuntimeErrors(
	uuid: string,
	version: number,
	options: { since?: string; limit?: number } = {}
): RuntimeError[] {
	const { since, limit = 50 } = options;
	const entries = readRuntimeLogs(uuid, version, { level: 'ERR', since, limit: 1000 });

	const errors: RuntimeError[] = [];
	const seen = new Set<string>();

	for (const entry of entries) {
		for (const pattern of ERROR_PATTERNS) {
			const match = entry.message.match(pattern.regex);
			if (match) {
				let file: string | undefined;
				let line: number | undefined;

				if (pattern.extractFile && match[1]) {
					file = match[1];
					line = match[2] ? parseInt(match[2]) : undefined;
				}

				// Deduplicate by combining category + first 100 chars of message
				const dedupeKey = `${pattern.category}:${entry.message.slice(0, 100)}`;
				if (seen.has(dedupeKey)) continue;
				seen.add(dedupeKey);

				errors.push({
					timestamp: entry.timestamp,
					file,
					line,
					message: entry.message,
					category: pattern.category
				});
				break; // First matching pattern wins
			}
		}
	}

	return errors.slice(-limit);
}

// ────────────────────────────────────────────────────────────────
// Log Summary
// ────────────────────────────────────────────────────────────────

/**
 * Get a summary of the runtime log for a workspace version.
 * Includes error count, last activity time, and recent errors.
 */
export function getRuntimeLogSummary(uuid: string, version: number): RuntimeLogSummary {
	const logPath = getRuntimeLogPath(uuid, version);

	if (!existsSync(logPath)) {
		return {
			totalLines: 0,
			errorCount: 0,
			lastActivity: null,
			errors: [],
			recentLogs: [],
			logFileSize: 0
		};
	}

	let logFileSize = 0;
	try {
		logFileSize = statSync(logPath).size;
	} catch {
		// ignore
	}

	const allLogs = readRuntimeLogs(uuid, version, { limit: 500 });
	const errors = extractRuntimeErrors(uuid, version, { limit: 20 });
	const recentLogs = allLogs.slice(-50);
	const errorCount = allLogs.filter(l => l.level === 'ERR').length;
	const lastActivity = allLogs.length > 0 ? allLogs[allLogs.length - 1].timestamp : null;

	return {
		totalLines: allLogs.length,
		errorCount,
		lastActivity,
		errors,
		recentLogs,
		logFileSize
	};
}

// ────────────────────────────────────────────────────────────────
// Error Formatting (for AI auto-fix prompts)
// ────────────────────────────────────────────────────────────────

/**
 * Format runtime errors into a concise prompt for the AI auto-fix system.
 * Groups errors by category for clarity.
 */
export function formatErrorsForAutofix(errors: RuntimeError[]): string {
	if (errors.length === 0) return 'No runtime errors detected.';

	const grouped = new Map<string, RuntimeError[]>();
	for (const err of errors) {
		const list = grouped.get(err.category) || [];
		list.push(err);
		grouped.set(err.category, list);
	}

	const sections: string[] = [];

	for (const [category, errs] of grouped) {
		const label = {
			crash: 'PROCESS CRASHES',
			uncaught: 'UNCAUGHT EXCEPTIONS',
			unhandled: 'UNHANDLED REJECTIONS',
			runtime: 'RUNTIME ERRORS',
			network: 'NETWORK ERRORS',
			database: 'DATABASE ERRORS',
			unknown: 'OTHER ERRORS'
		}[category] || 'ERRORS';

		sections.push(`## ${label}\n${errs.map((e, i) =>
			`${i + 1}. [${e.timestamp}] ${e.file ? `${e.file}${e.line ? `:${e.line}` : ''} — ` : ''}${e.message}`
		).join('\n')}`);
	}

	return sections.join('\n\n');
}

// ────────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────────

/**
 * Clean up old rotated runtime logs for a workspace version.
 * Keeps at most MAX_ROTATED_LOGS rotated files.
 */
export function cleanupRotatedLogs(uuid: string, version: number): void {
	const versionDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`);
	if (!existsSync(versionDir)) return;

	try {
		const files = readdirSync(versionDir)
			.filter(f => f.startsWith('runtime.') && f.endsWith('.log') && f !== 'runtime.log')
			.sort();

		const toDelete = files.slice(0, Math.max(0, files.length - MAX_ROTATED_LOGS));
		for (const f of toDelete) {
			try { unlinkSync(join(versionDir, f)); } catch { /* ignore */ }
		}
	} catch {
		// ignore
	}
}

/**
 * Get runtime errors for all deployed versions of a workspace.
 * Returns a map of version number to error array.
 */
export function getAllVersionErrors(uuid: string): Map<number, RuntimeError[]> {
	const result = new Map<number, RuntimeError[]>();
	const wsDir = join(WORKSPACES_ROOT, uuid, 'versions');

	if (!existsSync(wsDir)) return result;

	try {
		const dirs = readdirSync(wsDir, { withFileTypes: true })
			.filter(d => d.isDirectory() && /^v\d+$/.test(d.name));

		for (const dir of dirs) {
			const version = parseInt(dir.name.slice(1));
			const errors = extractRuntimeErrors(uuid, version, { limit: 10 });
			if (errors.length > 0) {
				result.set(version, errors);
			}
		}
	} catch {
		// ignore
	}

	return result;
}
