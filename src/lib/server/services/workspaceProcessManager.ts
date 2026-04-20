/**
 * Workspace Process Manager
 *
 * Manages lifecycle of workspace SSR node servers.
 * Each deployed workspace version runs as a child process on a dedicated port.
 * Requests to /apps/[uuid]/v[version]/* are proxied to the appropriate process.
 */

import { spawn, type ChildProcess } from 'child_process';
import {
	existsSync,
	mkdirSync,
	appendFileSync,
	statSync,
	renameSync,
	readdirSync,
	readFileSync,
	writeFileSync,
	unlinkSync
} from 'fs';
import * as http from 'http';
import * as net from 'net';
import { join, resolve } from 'path';
import { getWorkspaceIdentitySecret } from './workspaceIdentity';

const WORKSPACES_ROOT = resolve('workspaces');
// Soft-cap on the dynamic port range we ask the OS for. Each child still
// binds whatever the OS hands out via `server.listen(0)`; the cap exists
// only as a safety guard against pathological loops.
const MAX_CONCURRENT_PROCESSES = 20;

// Maximum runtime log file size before rotation (5 MB)
const MAX_RUNTIME_LOG_SIZE = 5 * 1024 * 1024;
// Keep at most this many rotated runtime.*.log files per workspace version.
const MAX_ROTATED_LOGS = 5;
// Crash-count map cleanup threshold — entries older than this are GC'd.
const CRASH_COUNT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface WorkspaceProcess {
	uuid: string;
	version: number;
	port: number;
	process: ChildProcess;
	ready: boolean;
	startedAt: Date;
}

/**
 * Get the runtime log file path for a workspace version.
 */
export function getRuntimeLogPath(uuid: string, version: number): string {
	return join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'runtime.log');
}

/** PID file used to reap orphaned workspace child apps after a portal restart. */
function getRuntimePidPath(uuid: string, version: number): string {
	return join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'runtime.pid');
}

/** Purge old rotated runtime logs to bound disk usage. */
function purgeOldRotatedLogs(uuid: string, version: number): void {
	try {
		const dir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`);
		if (!existsSync(dir)) return;
		const rotated = readdirSync(dir)
			.filter((n) => /^runtime\.\d+\.log$/.test(n))
			.map((n) => ({ name: n, path: join(dir, n), mtime: statSync(join(dir, n)).mtimeMs }))
			.sort((a, b) => b.mtime - a.mtime);
		for (const entry of rotated.slice(MAX_ROTATED_LOGS)) {
			try {
				unlinkSync(entry.path);
			} catch {
				// noop
			}
		}
	} catch {
		// noop
	}
}

/**
 * Append a line to the runtime log for a workspace version.
 */
function appendRuntimeLog(uuid: string, version: number, level: 'OUT' | 'ERR', text: string): void {
	try {
		const logPath = getRuntimeLogPath(uuid, version);
		const logDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`);
		if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

		try {
			const stats = statSync(logPath);
			if (stats.size > MAX_RUNTIME_LOG_SIZE) {
				const rotatedPath = logPath.replace('.log', `.${Date.now()}.log`);
				renameSync(logPath, rotatedPath);
				purgeOldRotatedLogs(uuid, version);
			}
		} catch {
			// File doesn't exist yet
		}

		const timestamp = new Date().toISOString();
		appendFileSync(logPath, `[${timestamp}] [${level}] ${text}\n`, 'utf-8');
	} catch {
		// Silently ignore — log capture is best-effort
	}
}

// Global registry of running workspace processes
const runningProcesses = new Map<string, WorkspaceProcess>();
// Tracks crash counts per workspace key for backoff logic
interface CrashEntry {
	count: number;
	lastSeen: number;
}
const crashCounts = new Map<string, CrashEntry>();

function bumpCrashCount(key: string): number {
	const entry = crashCounts.get(key);
	if (entry) {
		entry.count += 1;
		entry.lastSeen = Date.now();
		return entry.count;
	}
	const fresh: CrashEntry = { count: 1, lastSeen: Date.now() };
	crashCounts.set(key, fresh);
	return 1;
}

function getCrashCount(key: string): number {
	const entry = crashCounts.get(key);
	if (!entry) return 0;
	if (Date.now() - entry.lastSeen > CRASH_COUNT_TTL_MS) {
		crashCounts.delete(key);
		return 0;
	}
	return entry.count;
}

function gcCrashCounts(): void {
	const cutoff = Date.now() - CRASH_COUNT_TTL_MS;
	for (const [k, v] of crashCounts) {
		if (v.lastSeen < cutoff) crashCounts.delete(k);
	}
}
// Periodic GC, unrefed so it doesn't keep the process alive.
const _crashGcInterval = setInterval(gcCrashCounts, 60 * 60 * 1000);
if (typeof _crashGcInterval.unref === 'function') _crashGcInterval.unref();

/**
 * Get the process key for a workspace version.
 */
function processKey(uuid: string, version: number): string {
	return `${uuid}:v${version}`;
}

/**
 * Check if a workspace version has a deployment ready to serve.
 */
function isDeploymentReady(uuid: string, version: number): boolean {
	const deployDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'deployment');
	const indexJs = join(deployDir, 'index.js');
	return existsSync(indexJs);
}

/**
 * Evict the least recently used process if we're at the concurrent limit.
 */
function evictLRUIfNeeded(): void {
	if (runningProcesses.size < MAX_CONCURRENT_PROCESSES) return;

	let oldestKey: string | null = null;
	let oldestTime = Infinity;
	runningProcesses.forEach((wp, key) => {
		const t = wp.startedAt.getTime();
		if (t < oldestTime) {
			oldestTime = t;
			oldestKey = key;
		}
	});

	if (oldestKey) {
		const wp = runningProcesses.get(oldestKey)!;
		console.warn(
			`[WorkspaceProcessManager] Evicting LRU process ${wp.uuid} v${wp.version} (started ${wp.startedAt.toISOString()}) to make room`
		);
		try {
			wp.process.kill();
		} catch {
			// ignore
		}
		runningProcesses.delete(oldestKey);
		try {
			unlinkSync(getRuntimePidPath(wp.uuid, wp.version));
		} catch {
			// noop
		}
	}
}

/** Ask the OS for a free TCP port (avoids deterministic-hash collisions). */
function getEphemeralPort(): Promise<number> {
	return new Promise((resolveP, rejectP) => {
		const server = net.createServer();
		server.unref();
		server.once('error', rejectP);
		server.listen(0, '127.0.0.1', () => {
			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				server.close();
				return rejectP(new Error('Failed to read ephemeral port'));
			}
			const port = addr.port;
			server.close(() => resolveP(port));
		});
	});
}

/**
 * Build a sanitised env for spawned workspace child apps.
 *
 * The previous version forwarded the full `process.env`, leaking the
 * portal's `SESSION_SECRET`, `GEMINI_API_KEY`, `ADO_PAT`, `OPENCODE_API_KEY`,
 * etc. into every AI-generated app — and into the AI's shell tools —
 * making secret exfiltration trivial.
 */
function buildChildEnv(
	port: number,
	databasePath: string
): NodeJS.ProcessEnv {
	const allow = new Set([
		'PATH',
		'HOME',
		'USER',
		'USERNAME',
		'LOGNAME',
		'SHELL',
		'LANG',
		'LC_ALL',
		'TZ',
		'TMPDIR',
		'TEMP',
		'TMP',
		'PWD',
		'BUN_INSTALL',
		'BUN_RUNTIME_TRANSPILER_CACHE_PATH'
	]);
	const out: NodeJS.ProcessEnv = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (allow.has(k)) out[k] = v;
	}
	out.PORT = String(port);
	out.HOST = '127.0.0.1';
	// ORIGIN — see SvelteKit adapter-node CSRF behaviour. PUBLIC_ORIGIN is
	// the only env input that is ALWAYS safe to forward.
	out.ORIGIN = process.env.PUBLIC_ORIGIN ?? process.env.ORIGIN ?? 'http://localhost:5173';
	out.PROTOCOL_HEADER = 'x-forwarded-proto';
	out.HOST_HEADER = 'x-forwarded-host';
	out.NODE_ENV = 'production';
	out.DATABASE_PATH = databasePath;
	// Per-portal-process identity-signing secret so child apps can verify
	// forwarded `x-user-*` headers if they choose to. Even if they don't,
	// the secret being available means an opt-in fix is one constant away.
	out.WORKSPACE_IDENTITY_SECRET = getWorkspaceIdentitySecret();
	return out;
}

/**
 * Attempt to spawn a workspace process on a given port.
 */
function trySpawn(
	deployDir: string,
	port: number,
	uuid: string,
	version: number
): Promise<{ child: ChildProcess; exitedEarly: boolean; exitCode: number | null }> {
	const cwd = resolve('.');

	const workspaceDataDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'data');
	if (!existsSync(workspaceDataDir)) mkdirSync(workspaceDataDir, { recursive: true });
	const databasePath = join(workspaceDataDir, 'app.db');

	return new Promise((promiseResolve) => {
		const child = spawn('bun', [join(deployDir, 'index.js')], {
			cwd,
			env: buildChildEnv(port, databasePath),
			stdio: ['ignore', 'pipe', 'pipe']
		});

		const earlyExitTimer = setTimeout(() => {
			promiseResolve({ child, exitedEarly: false, exitCode: null });
		}, 2000);

		child.on('exit', (code) => {
			clearTimeout(earlyExitTimer);
			promiseResolve({ child, exitedEarly: true, exitCode: code });
		});
	});
}

/**
 * Start a workspace node server.
 */
export async function startWorkspaceProcess(uuid: string, version: number): Promise<number | null> {
	const key = processKey(uuid, version);

	const existing = runningProcesses.get(key);
	if (existing && existing.process.exitCode === null) {
		return existing.port;
	}

	if (!isDeploymentReady(uuid, version)) {
		console.warn(`[WorkspaceProcessManager] No deployment found for ${uuid} v${version}`);
		return null;
	}

	evictLRUIfNeeded();

	const deployDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'deployment');
	const MAX_PORT_RETRIES = 5;

	let child: ChildProcess | null = null;
	let port = 0;

	for (let attempt = 0; attempt <= MAX_PORT_RETRIES; attempt++) {
		let candidatePort: number;
		try {
			candidatePort = await getEphemeralPort();
		} catch (err) {
			console.error(`[WorkspaceProcessManager] Failed to allocate ephemeral port: ${err}`);
			return null;
		}

		console.log(
			`[WorkspaceProcessManager] Starting ${uuid} v${version} on port ${candidatePort}${attempt > 0 ? ` (retry ${attempt})` : ''}`
		);

		const result = await trySpawn(deployDir, candidatePort, uuid, version);

		if (result.exitedEarly && result.exitCode !== 0) {
			const portBusy = await isPortInUse(candidatePort);
			if (portBusy && attempt < MAX_PORT_RETRIES) {
				console.warn(
					`[WorkspaceProcessManager] Port ${candidatePort} was taken, retrying with another ephemeral port`
				);
				continue;
			}
			console.error(
				`[WorkspaceProcessManager] ${uuid} v${version} failed to start on port ${candidatePort} (exit code ${result.exitCode})`
			);
			return null;
		}

		child = result.child;
		port = candidatePort;
		break;
	}

	if (!child) {
		console.error(
			`[WorkspaceProcessManager] ${uuid} v${version} failed to start after ${MAX_PORT_RETRIES} port retries`
		);
		return null;
	}

	const wp: WorkspaceProcess = {
		uuid,
		version,
		port,
		process: child,
		ready: false,
		startedAt: new Date()
	};

	runningProcesses.set(key, wp);

	// Persist the PID so a portal restart can reap orphans.
	if (child.pid) {
		try {
			writeFileSync(getRuntimePidPath(uuid, version), String(child.pid), 'utf-8');
		} catch {
			// noop
		}
	}

	child.stdout?.on('data', (data: Buffer) => {
		const text = data.toString().trim();
		console.log(`[workspace:${uuid.slice(0, 8)}:v${version}] ${text}`);
		appendRuntimeLog(uuid, version, 'OUT', text);
		if (text.includes('Listening') || text.includes('listening') || text.includes(':' + port)) {
			wp.ready = true;
		}
	});

	child.stderr?.on('data', (data: Buffer) => {
		const text = data.toString().trim();
		console.error(`[workspace:${uuid.slice(0, 8)}:v${version}] ERR: ${text}`);
		appendRuntimeLog(uuid, version, 'ERR', text);
	});

	child.on('exit', (code) => {
		console.warn(`[WorkspaceProcessManager] ${uuid} v${version} exited with code ${code}`);
		appendRuntimeLog(uuid, version, 'ERR', `Process exited with code ${code}`);
		runningProcesses.delete(key);
		try {
			unlinkSync(getRuntimePidPath(uuid, version));
		} catch {
			// noop
		}

		if (code !== 0 && code !== null) {
			const total = bumpCrashCount(key);
			console.warn(`[WorkspaceProcessManager] ${uuid} v${version} crash count: ${total}`);
		}
	});

	const isReady = await waitForReady(wp, 5000);

	if (!isReady) {
		if (child.exitCode !== null) {
			console.error(
				`[WorkspaceProcessManager] ${uuid} v${version} exited (code ${child.exitCode}) and never became ready`
			);
			runningProcesses.delete(key);
			return null;
		}

		const healthy = await httpHealthCheck(port);
		if (healthy) {
			wp.ready = true;
		} else {
			console.warn(
				`[WorkspaceProcessManager] ${uuid} v${version} did not become ready within 5s and HTTP health check failed.`
			);
			wp.process.kill();
			runningProcesses.delete(key);
			return null;
		}
	}

	crashCounts.delete(key);
	return port;
}

/**
 * Perform an HTTP GET health check against a port.
 *
 * Resolves true only when the server returns a non-5xx status. The
 * previous implementation accepted ANY response (including 500) as
 * "alive", which masked startup crashes that surface only on the first
 * request.
 */
function httpHealthCheck(port: number, timeoutMs: number = 2000): Promise<boolean> {
	return new Promise((resolve) => {
		const req = http.get(`http://127.0.0.1:${port}/`, { timeout: timeoutMs }, (res) => {
			res.resume();
			const status = res.statusCode ?? 0;
			resolve(status > 0 && status < 500);
		});
		req.on('error', () => resolve(false));
		req.on('timeout', () => {
			req.destroy();
			resolve(false);
		});
	});
}

/**
 * Check if a port is already in use.
 */
function isPortInUse(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = net.createServer();
		server.once('error', (err: NodeJS.ErrnoException) => {
			if (err.code === 'EADDRINUSE') {
				resolve(true);
			} else {
				resolve(false);
			}
		});
		server.once('listening', () => {
			server.close();
			resolve(false);
		});
		server.listen(port, '127.0.0.1');
	});
}

function waitForReady(wp: WorkspaceProcess, timeoutMs: number): Promise<boolean> {
	return new Promise((resolve) => {
		if (wp.ready) return resolve(true);

		let settled = false;
		const settle = (value: boolean) => {
			if (settled) return;
			settled = true;
			clearInterval(interval);
			clearTimeout(timeout);
			resolve(value);
		};

		const timeout = setTimeout(async () => {
			const healthy = await httpHealthCheck(wp.port);
			if (healthy) {
				wp.ready = true;
				settle(true);
			} else {
				settle(false);
			}
		}, timeoutMs);

		const interval = setInterval(() => {
			if (wp.ready) {
				settle(true);
			}
		}, 100);
	});
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the port of a running workspace process, starting it if necessary.
 */
export async function getOrStartWorkspacePort(uuid: string, version: number): Promise<number | null> {
	const key = processKey(uuid, version);

	const existing = runningProcesses.get(key);
	if (existing && existing.process.exitCode === null) {
		return existing.port;
	}

	const crashes = getCrashCount(key);
	if (crashes > 10) {
		console.error(
			`[WorkspaceProcessManager] ${uuid} v${version} has crashed ${crashes} times — permanently failed. Clear crashCounts to retry.`
		);
		return null;
	}

	if (crashes > 3) {
		const backoffSec = Math.min(Math.pow(2, crashes), 60);
		console.warn(
			`[WorkspaceProcessManager] ${uuid} v${version} has crashed ${crashes} times — waiting ${backoffSec}s before restart`
		);
		await delay(backoffSec * 1000);
	}

	return startWorkspaceProcess(uuid, version);
}

/**
 * Stop a workspace process.
 */
export function stopWorkspaceProcess(uuid: string, version: number): void {
	const key = processKey(uuid, version);
	const wp = runningProcesses.get(key);
	if (wp) {
		wp.process.kill();
		runningProcesses.delete(key);
	}
	try {
		unlinkSync(getRuntimePidPath(uuid, version));
	} catch {
		// noop
	}
}

/**
 * Stop all workspace processes.
 */
export function stopAllWorkspaceProcesses(): void {
	for (const wp of runningProcesses.values()) {
		try {
			wp.process.kill();
		} catch {
			// ignore
		}
	}
	runningProcesses.clear();
}

/**
 * Reap any workspace child apps still alive from a previous portal run.
 *
 * After a portal restart, `runningProcesses` is empty but the spawned
 * `bun .../index.js` children remain bound to their ports — `trySpawn`
 * then trips on EADDRINUSE and the orphans serve stale code forever.
 *
 * This walks workspaces/<uuid>/versions/v<n>/runtime.pid, sends SIGTERM
 * to each, and removes the PID files. Called once at portal startup.
 */
export function reapOrphanWorkspaceProcesses(): { reaped: number; checked: number } {
	if (!existsSync(WORKSPACES_ROOT)) return { reaped: 0, checked: 0 };
	let reaped = 0;
	let checked = 0;
	let workspaces: string[];
	try {
		workspaces = readdirSync(WORKSPACES_ROOT, { withFileTypes: true })
			.filter((d) => d.isDirectory())
			.map((d) => d.name);
	} catch {
		return { reaped: 0, checked: 0 };
	}

	for (const uuid of workspaces) {
		const versionsDir = join(WORKSPACES_ROOT, uuid, 'versions');
		if (!existsSync(versionsDir)) continue;
		let versions: string[];
		try {
			versions = readdirSync(versionsDir).filter((n) => /^v\d+$/.test(n));
		} catch {
			continue;
		}
		for (const v of versions) {
			const pidPath = join(versionsDir, v, 'runtime.pid');
			if (!existsSync(pidPath)) continue;
			checked += 1;
			try {
				const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
				if (Number.isFinite(pid) && pid > 0) {
					try {
						process.kill(pid, 'SIGTERM');
						reaped += 1;
						console.log(`[WorkspaceProcessManager] Reaped orphan ${uuid}/${v} (PID ${pid})`);
					} catch {
						// process gone — fall through to unlink
					}
				}
				unlinkSync(pidPath);
			} catch {
				// noop
			}
		}
	}
	if (checked > 0) {
		console.log(
			`[WorkspaceProcessManager] Orphan reaper: checked ${checked} PID file(s), reaped ${reaped} process(es)`
		);
	}
	return { reaped, checked };
}

/**
 * Get status of all running workspace processes.
 */
export function getWorkspaceProcessStatus(): Array<{
	uuid: string;
	version: number;
	port: number;
	ready: boolean;
	startedAt: Date;
	crashCount: number;
}> {
	return Array.from(runningProcesses.values()).map(({ uuid, version, port, ready, startedAt }) => ({
		uuid,
		version,
		port,
		ready,
		startedAt,
		crashCount: getCrashCount(processKey(uuid, version))
	}));
}

/**
 * Get crash count for a specific workspace version.
 */
export function getWorkspaceCrashCount(uuid: string, version: number): number {
	return getCrashCount(processKey(uuid, version));
}

/**
 * Reset crash count for a specific workspace version.
 */
export function resetWorkspaceCrashCount(uuid: string, version: number): void {
	crashCounts.delete(processKey(uuid, version));
}

/**
 * Check if a specific workspace process is currently running and healthy.
 */
export async function checkWorkspaceHealth(uuid: string, version: number): Promise<{
	running: boolean;
	ready: boolean;
	healthy: boolean;
	port: number | null;
	crashCount: number;
	uptime: number | null;
}> {
	const key = processKey(uuid, version);
	const wp = runningProcesses.get(key);
	const crashes = getCrashCount(key);

	if (!wp || wp.process.exitCode !== null) {
		return { running: false, ready: false, healthy: false, port: null, crashCount: crashes, uptime: null };
	}

	const healthy = await httpHealthCheck(wp.port);
	const uptime = Date.now() - wp.startedAt.getTime();

	return {
		running: true,
		ready: wp.ready,
		healthy,
		port: wp.port,
		crashCount: crashes,
		uptime
	};
}

/**
 * Read the last few `[ERR]` lines from a workspace's runtime log.
 * Used by the proxy to enrich 502 responses with the real cause.
 */
export function readLastRuntimeErrors(uuid: string, version: number, lines = 3): string[] {
	try {
		const path = getRuntimeLogPath(uuid, version);
		if (!existsSync(path)) return [];
		const content = readFileSync(path, 'utf-8');
		const allLines = content.split('\n').filter((l) => l.includes('[ERR]'));
		return allLines.slice(-lines);
	} catch {
		return [];
	}
}
