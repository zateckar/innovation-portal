/**
 * Build Watchdog — consumes workspace `heartbeat.json` files written by
 * the builder process and marks builds as failed when the heartbeat goes
 * stale (process is alive but stuck in an infinite OpenCode wait, or
 * the builder process died without flushing a final state).
 *
 * Without this, a build whose PID is alive but stuck in an infinite loop
 * stays in `status: 'building'` forever — the existing PID-liveness check
 * in `/api/ideas/[id]/build` happily reports "build is in progress" and
 * the user has no recovery path.
 *
 * Runs every WATCHDOG_INTERVAL_MS while the portal is up.
 *
 * Marking a build as stuck:
 *   1. Heartbeat file exists, mtime older than STUCK_HEARTBEAT_MS
 *   2. metadata.status is one of the active build phases
 *   3. The recorded PID is alive (or unknown)
 *
 * → metadata.status = 'error', metadata.error = "Build appears stuck …"
 * → the recorded PID is killed (best effort)
 */
import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { updateMetadataAtomic, appendBuildLogEntry } from '../../../../scripts/metadata-store.ts';

const WORKSPACES_ROOT = resolve('workspaces');

const WATCHDOG_INTERVAL_MS = 2 * 60 * 1000; // 2 min
const STUCK_HEARTBEAT_MS = 25 * 60 * 1000; // 25 min — longer than any expected single AI call

const ACTIVE_BUILD_STATUSES = new Set([
	'building',
	'planning',
	'reviewing',
	'testing',
	'deploying',
	'creating',
	'interviewing'
]);

let interval: NodeJS.Timeout | null = null;

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function killBestEffort(pid: number): void {
	try {
		process.kill(pid, 'SIGTERM');
	} catch {
		// ignore — already dead or no permission
	}
}

async function checkOnce(): Promise<void> {
	if (!existsSync(WORKSPACES_ROOT)) return;

	let entries;
	try {
		entries = readdirSync(WORKSPACES_ROOT, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const uuid = entry.name;
		const wsDir = join(WORKSPACES_ROOT, uuid);
		const metaPath = join(wsDir, 'metadata.json');
		const heartbeatPath = join(wsDir, 'heartbeat.json');
		if (!existsSync(metaPath)) continue;

		let meta: { status?: string; buildPid?: number | null; error?: string };
		try {
			meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
		} catch {
			continue;
		}

		if (!meta.status || !ACTIVE_BUILD_STATUSES.has(meta.status)) continue;

		const pid = typeof meta.buildPid === 'number' ? meta.buildPid : null;
		const pidAlive = pid !== null ? isProcessAlive(pid) : null;

		// If we know the PID is dead, the build crashed → mark as error.
		if (pidAlive === false) {
			console.warn(
				`[buildWatchdog] ${uuid} status=${meta.status} but PID ${pid} is dead — marking as error`
			);
			await appendBuildLogEntry(
				uuid,
				'Build Watchdog',
				`Build process (PID ${pid}) died without updating status; marked as error.`,
				'error'
			);
			await updateMetadataAtomic(uuid, (m) => {
				m.status = 'error';
				if (!m.error) m.error = `Build process crashed (PID ${pid} is dead).`;
				m.buildPid = null;
				return m;
			});
			continue;
		}

		// Otherwise, look at heartbeat staleness.
		if (!existsSync(heartbeatPath)) continue;
		let stat;
		try {
			stat = statSync(heartbeatPath);
		} catch {
			continue;
		}
		const ageMs = Date.now() - stat.mtimeMs;
		if (ageMs <= STUCK_HEARTBEAT_MS) continue;

		const ageMin = Math.floor(ageMs / 60_000);
		console.warn(
			`[buildWatchdog] ${uuid} status=${meta.status}; heartbeat is ${ageMin} min stale — marking as stuck`
		);
		await appendBuildLogEntry(
			uuid,
			'Build Watchdog',
			`Build appears stuck (no heartbeat for ${ageMin} min). Killed PID ${pid ?? 'unknown'} and marked as error.`,
			'error'
		);
		await updateMetadataAtomic(uuid, (m) => {
			m.status = 'error';
			if (!m.error) m.error = `Build appears stuck (no heartbeat for ${ageMin} min).`;
			m.buildPid = null;
			return m;
		});
		if (pid !== null) killBestEffort(pid);
	}
}

/**
 * Start the watchdog. Idempotent — calling twice has no extra effect.
 */
export function startBuildWatchdog(): void {
	if (interval) return;
	console.log(`[buildWatchdog] Started (interval=${WATCHDOG_INTERVAL_MS / 1000}s, threshold=${STUCK_HEARTBEAT_MS / 60_000}min)`);
	// Fire once on startup for immediate detection of orphans from the previous run.
	void checkOnce();
	interval = setInterval(() => {
		void checkOnce();
	}, WATCHDOG_INTERVAL_MS);
	// Allow process to exit even if this timer is pending.
	if (typeof interval.unref === 'function') interval.unref();
}

export function stopBuildWatchdog(): void {
	if (interval) {
		clearInterval(interval);
		interval = null;
	}
}
