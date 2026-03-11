/**
 * Server-side logger with file output, daily rotation, and runtime-configurable log level.
 *
 * Log file path: LOG_FILE env var (absolute or relative to cwd).
 * Default: <cwd>/data/logs/server.log  — inside the persistent data volume in Docker.
 *
 * Log level: settable at runtime via setLogLevel() (called from settings save action).
 * Initial value: LOG_LEVEL env var (DEBUG/INFO/WARN/ERROR), falling back to the
 * value stored in the DB settings row (loaded async after startup).
 */

import { appendFileSync, mkdirSync, existsSync, renameSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname, basename, isAbsolute } from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export const LOG_LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

// ─── Log file path ────────────────────────────────────────────────────────────
// Default to data/logs/server.log so it lands inside the persistent Docker volume.
const logFileEnv = process.env.LOG_FILE || 'data/logs/server.log';
export const logPath = isAbsolute(logFileEnv)
	? logFileEnv
	: join(process.cwd(), logFileEnv);
export const logFile = logFileEnv; // raw value shown in UI
const logDir = dirname(logPath);
const logBaseName = basename(logPath);

try {
	mkdirSync(logDir, { recursive: true });
} catch {
	// Directory already exists or cannot be created — file logging may be unavailable
}

// ─── Mutable log level (runtime-configurable) ─────────────────────────────────
// Validate the env var against the known levels so that _currentLevel and _minLevel
// are always consistent (an invalid value such as 'VERBOSE' falls back to 'INFO').
const _envLevel = process.env.LOG_LEVEL?.toUpperCase() as LogLevel;
const _validatedStartLevel: LogLevel = LOG_LEVELS[_envLevel] !== undefined ? _envLevel : 'INFO';
let _minLevel: number = LOG_LEVELS[_validatedStartLevel];
let _currentLevel: LogLevel = _validatedStartLevel;

export function getLogLevel(): LogLevel {
	return _currentLevel;
}

export function setLogLevel(level: LogLevel): void {
	_currentLevel = level;
	_minLevel = LOG_LEVELS[level] ?? LOG_LEVELS.INFO;
}

// ─── Daily Log Rotation ───────────────────────────────────────────────────────
const _parsedKeepDays = parseInt(process.env.LOG_ROTATION_KEEP_DAYS || '7', 10);
// Guard against NaN (non-numeric env value) which would silently disable cleanup
const LOG_ROTATION_KEEP_DAYS = Number.isFinite(_parsedKeepDays) && _parsedKeepDays > 0 ? _parsedKeepDays : 7;
let currentLogDate = new Date().toISOString().slice(0, 10);

function getRotatedName(date: string): string {
	const dotIdx = logBaseName.lastIndexOf('.');
	if (dotIdx === -1) return `${logBaseName}.${date}`;
	return `${logBaseName.slice(0, dotIdx)}.${date}${logBaseName.slice(dotIdx)}`;
}

function rotateLogs(): void {
	try {
		const rotatedPath = join(logDir, getRotatedName(currentLogDate));
		if (existsSync(logPath)) renameSync(logPath, rotatedPath);

		const entries = readdirSync(logDir);
		const dotIdx = logBaseName.lastIndexOf('.');
		const prefix = dotIdx !== -1 ? logBaseName.slice(0, dotIdx) : logBaseName;
		const suffix = dotIdx !== -1 ? logBaseName.slice(dotIdx) : '';
		const rotated = entries
			.filter((f) => f !== logBaseName && f.startsWith(prefix) && f.endsWith(suffix))
			.sort();
		const toDelete = rotated.slice(0, Math.max(0, rotated.length - LOG_ROTATION_KEEP_DAYS));
		for (const f of toDelete) {
			try { unlinkSync(join(logDir, f)); } catch { /* ignore */ }
		}
	} catch {
		// Rotation failure is non-fatal
	}
}

// ─── Core write function ──────────────────────────────────────────────────────
export function writeToLog(level: LogLevel, args: unknown[]): void {
	if (LOG_LEVELS[level] < _minLevel) return;

	try {
		const now = new Date();
		const today = now.toISOString().slice(0, 10);

	if (today !== currentLogDate) {
		// Update currentLogDate BEFORE calling rotateLogs() so that a second
		// concurrent caller skips this branch and avoids a double-rotation.
		currentLogDate = today;
		rotateLogs();
	}

		const message = args
			.map((a) => {
				if (typeof a === 'string') return a;
				if (a instanceof Error) return `${a.message}\n${a.stack ?? ''}`;
				try { return JSON.stringify(a); } catch { return String(a); }
			})
			.join(' ');

		appendFileSync(logPath, `[${now.toISOString()}] [${level}] ${message}\n`, 'utf-8');
	} catch {
		// Silently ignore — avoids infinite recursion if console is patched
	}
}

// ─── Console monkey-patching ──────────────────────────────────────────────────
// Called once from hooks.server.ts on startup.
//
// IMPORTANT: This is an intentional, permanent global side-effect in production.
// In development with Vite HMR, module state (including `_patched`) can be reset
// on hot-reload. The guard below prevents double-wrapping during normal HMR cycles,
// but does not fully protect against multiple full module re-evaluations.
// If double-patching is observed in dev, restart the dev server.
let _patched = false;
export function patchConsole(): void {
	if (_patched) return;
	_patched = true;

	const _log = console.log.bind(console);
	const _info = console.info.bind(console);
	const _warn = console.warn.bind(console);
	const _error = console.error.bind(console);
	const _debug = console.debug.bind(console);

	console.log   = (...args: unknown[]) => { _log(...args);   writeToLog('INFO',  args); };
	console.info  = (...args: unknown[]) => { _info(...args);  writeToLog('INFO',  args); };
	console.warn  = (...args: unknown[]) => { _warn(...args);  writeToLog('WARN',  args); };
	console.error = (...args: unknown[]) => { _error(...args); writeToLog('ERROR', args); };
	console.debug = (...args: unknown[]) => { _debug(...args); writeToLog('DEBUG', args); };
}
