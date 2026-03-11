import type { Handle } from '@sveltejs/kit';
import { validateSession, initializeAdminFromEnv, type SessionUser } from '$lib/server/services/auth';
import { initializeJobs } from '$lib/server/jobs/scheduler';
import { appendFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname, basename } from 'path';

// ─── Logging Configuration ────────────────────────────────────────────────────

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
const LOG_LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

// Minimum level to write to file (default: INFO). Set LOG_LEVEL=DEBUG/INFO/WARN/ERROR
const configuredLevel = (process.env.LOG_LEVEL?.toUpperCase() as LogLevel) || 'INFO';
const minLevel = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.INFO;

const logFile = process.env.LOG_FILE || 'server.log';
const logPath = join(process.cwd(), logFile);
const logDir = dirname(logPath);
const logBaseName = basename(logPath); // e.g. "server.log"

try {
	mkdirSync(logDir, { recursive: true });
} catch {
	// Directory already exists or cannot be created — proceed without file logging
}

// ─── Daily Log Rotation ───────────────────────────────────────────────────────

// Keep this many rotated log files (days)
const LOG_ROTATION_KEEP_DAYS = parseInt(process.env.LOG_ROTATION_KEEP_DAYS || '7', 10);

let currentLogDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function getRotatedName(date: string): string {
	// e.g. server.log → server.2026-03-10.log
	const dotIdx = logBaseName.lastIndexOf('.');
	if (dotIdx === -1) return `${logBaseName}.${date}`;
	return `${logBaseName.slice(0, dotIdx)}.${date}${logBaseName.slice(dotIdx)}`;
}

function rotateLogs(): void {
	try {
		const rotatedPath = join(logDir, getRotatedName(currentLogDate));
		if (existsSync(logPath)) {
			renameSync(logPath, rotatedPath);
		}
		// Clean up old rotated files beyond retention window
		const entries = readdirSync(logDir);
		const prefix = logBaseName.slice(0, logBaseName.lastIndexOf('.') !== -1 ? logBaseName.lastIndexOf('.') : undefined);
		const suffix = logBaseName.slice(logBaseName.lastIndexOf('.') !== -1 ? logBaseName.lastIndexOf('.') : logBaseName.length);
		const rotatedFiles = entries
			.filter((f) => f !== logBaseName && f.startsWith(prefix) && f.endsWith(suffix))
			.sort();
		const toDelete = rotatedFiles.slice(0, Math.max(0, rotatedFiles.length - LOG_ROTATION_KEEP_DAYS));
		for (const f of toDelete) {
			try { unlinkSync(join(logDir, f)); } catch { /* ignore */ }
		}
	} catch {
		// Rotation failure is non-fatal
	}
}

function writeToLog(level: LogLevel, args: unknown[]): void {
	// Filter by configured minimum log level
	if (LOG_LEVELS[level] < minLevel) return;

	try {
		const now = new Date();
		const today = now.toISOString().slice(0, 10);

		// Rotate on day change
		if (today !== currentLogDate) {
			rotateLogs();
			currentLogDate = today;
		}

		const timestamp = now.toISOString();
		const message = args
			.map((a) => {
				if (typeof a === 'string') return a;
				if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`;
				try { return JSON.stringify(a); } catch { return String(a); }
			})
			.join(' ');

		appendFileSync(logPath, `[${timestamp}] [${level}] ${message}\n`, 'utf-8');
	} catch {
		// Silently ignore file write errors to avoid infinite recursion
	}
}

// ─── Console Monkey-Patching ──────────────────────────────────────────────────

const _consoleLog = console.log.bind(console);
const _consoleInfo = console.info.bind(console);
const _consoleWarn = console.warn.bind(console);
const _consoleError = console.error.bind(console);

console.log = (...args: unknown[]) => { _consoleLog(...args); writeToLog('INFO', args); };
console.info = (...args: unknown[]) => { _consoleInfo(...args); writeToLog('INFO', args); };
console.warn = (...args: unknown[]) => { _consoleWarn(...args); writeToLog('WARN', args); };
console.error = (...args: unknown[]) => { _consoleError(...args); writeToLog('ERROR', args); };

// ─── Initialization ───────────────────────────────────────────────────────────

// Initialize admin from environment variables on startup (runs once)
const initPromise = initializeAdminFromEnv();
initializeJobs();

export const handle: Handle = async ({ event, resolve }) => {
	// Ensure initialization completes before handling requests
	await initPromise;

	const sessionId = event.cookies.get('session');

	if (sessionId) {
		const user = await validateSession(sessionId);
		if (user) {
			event.locals.user = user;
		} else {
			// Invalid or expired session, clear cookie
			event.cookies.delete('session', { path: '/' });
		}
	}

	return resolve(event);
};
