/**
 * Metadata Store — single, atomic, mutex-guarded entry point for every
 * read-modify-write of `workspaces/<uuid>/metadata.json`.
 *
 * Multiple processes (the builder subprocess, the portal API endpoints,
 * the autofix endpoint) all mutate the same JSON file. Without this
 * module they race: each does `JSON.parse(readFileSync) → mutate →
 * writeFileSync` with no locking, dropping log entries and occasionally
 * leaving the file as `}{` (unparseable) on crash.
 *
 * All writes go through `atomicWriteFile` (tmp + rename) and are
 * serialised by an in-process per-uuid mutex (`withLock`).
 *
 * Bounds enforced here so no caller can blow up the file:
 *   - `buildLog`: capped at MAX_BUILD_LOG_ENTRIES (oldest dropped + marker)
 *   - each entry message: capped at MAX_LOG_MESSAGE_CHARS
 *   - `previousBuildLogs`: capped at MAX_ARCHIVED_LOGS
 *   - each archived log's entries: capped at MAX_BUILD_LOG_ENTRIES
 */
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { atomicWriteFile, withLock, workspaceLockKey } from './atomic-fs.ts';

const WORKSPACES_ROOT = resolve(import.meta.dirname, '..', 'workspaces');

export const MAX_BUILD_LOG_ENTRIES = 500;
export const MAX_ARCHIVED_LOGS = 5;
export const MAX_LOG_MESSAGE_CHARS = 4000;
export const MAX_LAST_ERROR_OUTPUT_CHARS = 8000;

export interface BuildLogEntry {
	timestamp: string;
	phase: string;
	message: string;
	status: 'started' | 'completed' | 'error' | 'info';
}

interface MetadataShape {
	uuid?: string;
	status?: string;
	error?: string;
	currentPhase?: string;
	buildLog?: BuildLogEntry[];
	previousBuildLogs?: Array<{
		archivedAt: string;
		status: string;
		error: string | null;
		entries: BuildLogEntry[];
	}>;
	buildPid?: number | null;
	buildStartedAt?: string | null;
	buildType?: 'initial' | 'rebuild' | 'autofix';
	autofixAttempts?: number;
	lastErrorOutput?: string;
	lastUpdated?: string;
	[key: string]: unknown;
}

function metadataPath(uuid: string): string {
	return join(WORKSPACES_ROOT, uuid, 'metadata.json');
}

function readMetadataSafe(uuid: string): MetadataShape | null {
	const p = metadataPath(uuid);
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, 'utf-8')) as MetadataShape;
	} catch (err) {
		// Torn file — try once more after a brief pause; if still bad, return null.
		try {
			return JSON.parse(readFileSync(p, 'utf-8')) as MetadataShape;
		} catch {
			console.error(`[metadata-store] Unparseable metadata.json for ${uuid}: ${err}`);
			return null;
		}
	}
}

function clampMessage(msg: string): string {
	if (msg.length <= MAX_LOG_MESSAGE_CHARS) return msg;
	return msg.slice(0, MAX_LOG_MESSAGE_CHARS) + `… [truncated, ${msg.length - MAX_LOG_MESSAGE_CHARS} chars omitted]`;
}

function boundBuildLog(log: BuildLogEntry[] | undefined): BuildLogEntry[] {
	if (!log || log.length === 0) return [];
	if (log.length <= MAX_BUILD_LOG_ENTRIES) return log;
	const dropped = log.length - MAX_BUILD_LOG_ENTRIES + 1;
	return [
		{
			timestamp: new Date().toISOString(),
			phase: 'log-truncation',
			message: `[…log truncated, ${dropped} oldest entries dropped to stay under ${MAX_BUILD_LOG_ENTRIES} entries]`,
			status: 'info'
		},
		...log.slice(-(MAX_BUILD_LOG_ENTRIES - 1))
	];
}

/**
 * Atomically apply `updater` to the workspace metadata.
 * The updater receives the current metadata (or {} if missing) and
 * returns the new metadata. Returns the new metadata.
 *
 * If the workspace metadata file does not exist, the update is skipped
 * (returns null) — this is the safest behaviour for crash-handler paths
 * that may run before metadata has been initialised.
 */
export async function updateMetadataAtomic(
	uuid: string,
	updater: (current: MetadataShape) => MetadataShape | void
): Promise<MetadataShape | null> {
	if (!uuid) return null;
	return withLock(workspaceLockKey(uuid), () => {
		const p = metadataPath(uuid);
		if (!existsSync(p)) return null;
		const current = readMetadataSafe(uuid) ?? {};
		const updated = updater(current) ?? current;
		updated.lastUpdated = new Date().toISOString();
		updated.buildLog = boundBuildLog(updated.buildLog);
		// Bound archive count and per-archive entry count
		if (Array.isArray(updated.previousBuildLogs)) {
			if (updated.previousBuildLogs.length > MAX_ARCHIVED_LOGS) {
				updated.previousBuildLogs = updated.previousBuildLogs.slice(-MAX_ARCHIVED_LOGS);
			}
			updated.previousBuildLogs = updated.previousBuildLogs.map((archive) => ({
				...archive,
				entries: boundBuildLog(archive.entries)
			}));
		}
		atomicWriteFile(p, JSON.stringify(updated, null, 2));
		return updated;
	});
}

/**
 * Append a single buildLog entry atomically. Bound + atomic + locked.
 * Safe to call from any process / phase. Silently no-ops if metadata
 * doesn't exist (so logging failures never break a build).
 */
export async function appendBuildLogEntry(
	uuid: string,
	phase: string,
	message: string,
	status: BuildLogEntry['status'] = 'info'
): Promise<void> {
	if (!uuid) return;
	try {
		await updateMetadataAtomic(uuid, (m) => {
			if (!Array.isArray(m.buildLog)) m.buildLog = [];
			m.buildLog.push({
				timestamp: new Date().toISOString(),
				phase,
				message: clampMessage(message),
				status
			});
			m.currentPhase = phase;
			return m;
		});
	} catch (err) {
		// Logging must never throw out of band.
		console.error(`[metadata-store] appendBuildLogEntry failed for ${uuid}:`, err);
	}
}

/**
 * Synchronous, best-effort variant for use inside signal handlers
 * (`uncaughtException`/`SIGTERM`) where awaiting a Promise is unsafe.
 * Skips the mutex (acceptable for terminal-state writes).
 */
export function updateMetadataSyncBestEffort(
	uuid: string,
	updates: Partial<MetadataShape>
): void {
	if (!uuid) return;
	try {
		const p = metadataPath(uuid);
		if (!existsSync(p)) return;
		const current = readMetadataSafe(uuid) ?? {};
		const merged: MetadataShape = { ...current, ...updates, lastUpdated: new Date().toISOString() };
		merged.buildLog = boundBuildLog(merged.buildLog);
		atomicWriteFile(p, JSON.stringify(merged, null, 2));
	} catch (err) {
		console.error(`[metadata-store] best-effort write failed for ${uuid}:`, err);
	}
}

/** Read the metadata. Returns null if missing or unparseable. */
export function readMetadataSafeExt(uuid: string): MetadataShape | null {
	return readMetadataSafe(uuid);
}

/** Truncate large stderr/stdout buffers before persisting them. */
export function clampLastError(text: string): string {
	if (text.length <= MAX_LAST_ERROR_OUTPUT_CHARS) return text;
	const head = text.slice(0, Math.floor(MAX_LAST_ERROR_OUTPUT_CHARS * 0.4));
	const tail = text.slice(-Math.floor(MAX_LAST_ERROR_OUTPUT_CHARS * 0.6));
	return `${head}\n…[${text.length - MAX_LAST_ERROR_OUTPUT_CHARS} chars omitted]…\n${tail}`;
}
