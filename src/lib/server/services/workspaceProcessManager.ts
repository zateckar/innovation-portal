/**
 * Workspace Process Manager
 *
 * Manages lifecycle of workspace SSR node servers.
 * Each deployed workspace version runs as a child process on a dedicated port.
 * Requests to /apps/[uuid]/v[version]/* are proxied to the appropriate process.
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync, mkdirSync, appendFileSync, statSync, renameSync } from 'fs';
import * as http from 'http';
import * as net from 'net';
import { join, resolve } from 'path';

const WORKSPACES_ROOT = resolve('workspaces');
// Base port for workspace processes (each workspace gets an offset based on a hash of its uuid+version)
const BASE_PORT = 4100;
const PORT_RANGE = 900; // Ports 4100-4999
const MAX_CONCURRENT_PROCESSES = 20;

// Maximum runtime log file size before rotation (5 MB)
const MAX_RUNTIME_LOG_SIZE = 5 * 1024 * 1024;

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

/**
 * Append a line to the runtime log for a workspace version.
 * Creates the directory structure if needed. Silently ignores write failures.
 */
function appendRuntimeLog(uuid: string, version: number, level: 'OUT' | 'ERR', text: string): void {
	try {
		const logPath = getRuntimeLogPath(uuid, version);
		const logDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`);
		if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

		// Rotate if log is too large
		try {
			const stats = statSync(logPath);
			if (stats.size > MAX_RUNTIME_LOG_SIZE) {
				const rotatedPath = logPath.replace('.log', `.${Date.now()}.log`);
				renameSync(logPath, rotatedPath);
			}
		} catch {
			// File doesn't exist yet or stat failed — fine
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
const crashCounts = new Map<string, number>();

/**
 * Compute a deterministic port for a workspace version.
 * Uses a hash of uuid+version to assign a consistent port in the range.
 */
function computePort(uuid: string, version: number): number {
	let hash = 0;
	const str = `${uuid}-v${version}`;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return BASE_PORT + (Math.abs(hash) % PORT_RANGE);
}

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
	}
}

/**
 * Attempt to spawn a workspace process on a given port.
 * Returns the ChildProcess, or null if the process exits immediately (within 2s)
 * due to a port conflict or other error.
 */
function trySpawn(
	deployDir: string,
	port: number,
	uuid: string,
	version: number
): Promise<{ child: ChildProcess; exitedEarly: boolean; exitCode: number | null }> {
	const cwd = resolve('.'); // Resolve cwd before entering the Promise to avoid shadowing

	// Each workspace gets its own database directory to prevent cross-contamination.
	// Without this, all workspace apps share data/app.db and overwrite each other's
	// schemas, causing "no such column" errors when different apps have different tables.
	const workspaceDataDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'data');
	if (!existsSync(workspaceDataDir)) mkdirSync(workspaceDataDir, { recursive: true });
	const databasePath = join(workspaceDataDir, 'app.db');

	return new Promise((promiseResolve) => {
		const child = spawn('node', [join(deployDir, 'index.js')], {
			cwd, // Run from project root so data/fixtures paths resolve correctly
			env: {
				...process.env,
				PORT: String(port),
				HOST: '127.0.0.1',
				// Do NOT set ORIGIN — let adapter-node derive it from forwarded headers.
				// The proxy sends x-forwarded-host and x-forwarded-proto which reflect
				// the actual browser origin. Hardcoding ORIGIN to "http://localhost:..."
				// breaks SvelteKit's CSRF check when the user accesses the app via any
				// other hostname (127.0.0.1, an IP address, a real domain, etc.).
				PROTOCOL_HEADER: 'x-forwarded-proto',
				HOST_HEADER: 'x-forwarded-host',
				NODE_ENV: 'production',
				DATABASE_PATH: databasePath
			},
			stdio: ['ignore', 'pipe', 'pipe']
		});

		const earlyExitTimer = setTimeout(() => {
			// Process survived 2 seconds — not an immediate crash
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
 * Returns the port it's running on, or null if startup failed.
 */
export async function startWorkspaceProcess(uuid: string, version: number): Promise<number | null> {
	const key = processKey(uuid, version);

	// Already running?
	const existing = runningProcesses.get(key);
	if (existing && existing.process.exitCode === null) {
		return existing.port;
	}

	if (!isDeploymentReady(uuid, version)) {
		console.warn(`[WorkspaceProcessManager] No deployment found for ${uuid} v${version}`);
		return null;
	}

	// Evict LRU process if at concurrent limit
	evictLRUIfNeeded();

	const deployDir = join(WORKSPACES_ROOT, uuid, 'versions', `v${version}`, 'deployment');
	let port = computePort(uuid, version);
	const MAX_PORT_RETRIES = 10;

	let child: ChildProcess | null = null;

	// Port collision retry loop
	for (let attempt = 0; attempt <= MAX_PORT_RETRIES; attempt++) {
		const candidatePort = port + attempt;
		console.log(
			`[WorkspaceProcessManager] Starting ${uuid} v${version} on port ${candidatePort}${attempt > 0 ? ` (retry ${attempt})` : ''}`
		);

		const result = await trySpawn(deployDir, candidatePort, uuid, version);

		if (result.exitedEarly && result.exitCode !== 0) {
			// Process exited immediately — check if port is in use
			const portBusy = await isPortInUse(candidatePort);
			if (portBusy && attempt < MAX_PORT_RETRIES) {
				console.warn(
					`[WorkspaceProcessManager] Port ${candidatePort} is in use, trying ${candidatePort + 1}`
				);
				continue;
			}
			// Not a port issue or exhausted retries
			console.error(
				`[WorkspaceProcessManager] ${uuid} v${version} failed to start on port ${candidatePort} (exit code ${result.exitCode})`
			);
			return null;
		}

		// Process survived or exited with code 0
		child = result.child;
		port = candidatePort;
		break;
	}

	if (!child) {
		console.error(`[WorkspaceProcessManager] ${uuid} v${version} failed to start after ${MAX_PORT_RETRIES} port retries`);
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

		// Track unexpected exits for crash counting
		if (code !== 0 && code !== null) {
			const prev = crashCounts.get(key) ?? 0;
			crashCounts.set(key, prev + 1);
			console.warn(
				`[WorkspaceProcessManager] ${uuid} v${version} crash count: ${prev + 1}`
			);
		}
	});

	// Wait up to 5 seconds for the process to become ready (stdout signal or HTTP health check)
	const isReady = await waitForReady(wp, 5000);

	if (!isReady) {
		// Check if the process has already exited
		if (child.exitCode !== null) {
			console.error(
				`[WorkspaceProcessManager] ${uuid} v${version} exited (code ${child.exitCode}) and never became ready`
			);
			runningProcesses.delete(key);
			return null;
		}

		// Process is still alive — try one final HTTP health check
		const healthy = await httpHealthCheck(port);
		if (healthy) {
			wp.ready = true;
		} else {
			console.warn(
				`[WorkspaceProcessManager] ${uuid} v${version} did not become ready within 5s and HTTP health check failed. Process is still running but may not be serving.`
			);
			// Do NOT mark ready — leave ready=false. Return null to indicate startup failure.
			wp.process.kill();
			runningProcesses.delete(key);
			return null;
		}
	}

	// Reset crash count on successful start
	crashCounts.delete(key);

	return port;
}

/**
 * Perform an HTTP GET health check against a port.
 * Resolves true if any HTTP response is received, false otherwise.
 */
function httpHealthCheck(port: number, timeoutMs: number = 2000): Promise<boolean> {
	return new Promise((resolve) => {
		const req = http.get(`http://127.0.0.1:${port}/`, { timeout: timeoutMs }, (res) => {
			// Any response means the server is alive
			res.resume(); // drain the response
			resolve(true);
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

/**
 * Wait for a workspace process to signal readiness via stdout or HTTP health check.
 * Returns true if the process is confirmed ready, false otherwise.
 */
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
			// Timeout reached — try an HTTP health check as last resort
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

/**
 * Delay helper.
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the port of a running workspace process, starting it if necessary.
 * Returns null if the workspace doesn't exist or can't start.
 * Implements crash backoff: if a workspace has crashed repeatedly, delays restart
 * attempts. If crash count exceeds 10, permanently fails.
 */
export async function getOrStartWorkspacePort(uuid: string, version: number): Promise<number | null> {
	const key = processKey(uuid, version);

	// Check if already running
	const existing = runningProcesses.get(key);
	if (existing && existing.process.exitCode === null) {
		return existing.port;
	}

	// Check crash count for backoff
	const crashes = crashCounts.get(key) ?? 0;
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

	// Start it
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
		crashCount: crashCounts.get(processKey(uuid, version)) ?? 0
	}));
}

/**
 * Get crash count for a specific workspace version.
 */
export function getWorkspaceCrashCount(uuid: string, version: number): number {
	return crashCounts.get(processKey(uuid, version)) ?? 0;
}

/**
 * Reset crash count for a specific workspace version (used after successful auto-fix).
 */
export function resetWorkspaceCrashCount(uuid: string, version: number): void {
	crashCounts.delete(processKey(uuid, version));
}

/**
 * Check if a specific workspace process is currently running and healthy.
 * Returns { running, ready, port, crashCount } status object.
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
	const crashes = crashCounts.get(key) ?? 0;

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
