import { execSync, execFileSync, spawn } from 'child_process';
import { writeFileSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as net from 'net';
import { atomicWriteFile } from './atomic-fs.ts';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export interface AgentResponse {
	success: boolean;
	output: string;
	error?: string;
}

export interface AgentOptions {
	workDir: string;
	timeout?: number; // ms, default 10 minutes
	/** Optional opaque session ID — when set, all calls in this group share an OpenCode session. */
	sessionId?: string;
}

const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes

// Allow per-process customisation so concurrent builders don't share a port.
// Default keeps backwards compatibility with the legacy hard-coded port.
const BUILDER_SERVER_PORT = (() => {
	const env = process.env.OPENCODE_BUILDER_PORT;
	if (env && /^\d+$/.test(env)) return parseInt(env, 10);
	// Spread by PID so two concurrent builders rarely collide.
	const base = 14567;
	const offset = process.pid % 1000;
	return base + offset;
})();

// On-disk PID file so a portal restart can reap the previous run's server.
const SERVER_PID_FILE = join(
	process.env.TMPDIR ?? process.env.TEMP ?? '/tmp',
	`opencode-builder-${BUILDER_SERVER_PORT}.pid`
);

// ────────────────────────────────────────────────────────────────
// Heartbeat — write progress to disk so the watchdog can detect
// stalled builds (consumed by `buildWatchdog` in the portal).
// ────────────────────────────────────────────────────────────────

let heartbeatPath: string | null = null;

export function setHeartbeatPath(path: string): void {
	heartbeatPath = path;
}

function writeHeartbeat(phase: string): void {
	if (!heartbeatPath) return;
	try {
		const data = JSON.stringify({
			timestamp: new Date().toISOString(),
			phase,
			pid: process.pid
		});
		// Atomic so a stat() during a write never sees a torn file.
		atomicWriteFile(heartbeatPath, data);
	} catch {
		// Non-fatal
	}
}

// ────────────────────────────────────────────────────────────────
// Server Management — with health checks and auto-restart
// ────────────────────────────────────────────────────────────────

let serverStarted = false;
let serverPid: number | null = null;

const isWindows = process.platform === 'win32';

/**
 * Promise-based sleep. Replaces the previous `execSync('sleep 0.5')`
 * which silently busy-spun on Windows (no `sleep` command in cmd.exe).
 */
function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * Check if the OpenCode server port is listening using Node's `net` module.
 *
 * Replaces the previous chain of `netstat`/`ss`/`bun --eval "require('net')..."`
 * which all had failure modes (busy spin, missing binary, CJS-in-eval drift).
 */
function isPortListening(timeoutMs = 1500): Promise<boolean> {
	return new Promise((resolve) => {
		const sock = new net.Socket();
		let settled = false;
		const done = (ok: boolean) => {
			if (settled) return;
			settled = true;
			try {
				sock.destroy();
			} catch {
				// noop
			}
			resolve(ok);
		};
		sock.setTimeout(timeoutMs);
		sock.once('connect', () => done(true));
		sock.once('error', () => done(false));
		sock.once('timeout', () => done(false));
		try {
			sock.connect(BUILDER_SERVER_PORT, '127.0.0.1');
		} catch {
			done(false);
		}
	});
}

function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function killServer(): void {
	if (serverPid && isPidAlive(serverPid)) {
		try {
			process.kill(serverPid, 'SIGTERM');
			console.log(`  [server] Killed OpenCode server (PID ${serverPid})`);
		} catch {
			// Already dead
		}
	}
	serverPid = null;
	serverStarted = false;
	try {
		if (existsSync(SERVER_PID_FILE)) unlinkSync(SERVER_PID_FILE);
	} catch {
		// noop
	}
}

/**
 * Reap any leftover OpenCode server PID written to the PID file by a
 * previous portal/builder run. Called once at module load so a fresh
 * builder doesn't end up with two servers fighting for the port.
 */
function reapStaleServer(): void {
	try {
		if (!existsSync(SERVER_PID_FILE)) return;
		const pidStr = readFileSync(SERVER_PID_FILE, 'utf-8').trim();
		const pid = parseInt(pidStr, 10);
		if (Number.isFinite(pid) && pid > 0 && isPidAlive(pid)) {
			try {
				process.kill(pid, 'SIGTERM');
				console.log(`  [server] Reaped stale OpenCode server (PID ${pid})`);
			} catch {
				// not ours / already dead
			}
		}
		unlinkSync(SERVER_PID_FILE);
	} catch {
		// noop — best effort
	}
}
reapStaleServer();

/**
 * Start the OpenCode server and wait for it to be ready.
 */
async function startServer(): Promise<boolean> {
	console.log(`  [server] Starting headless OpenCode server on port ${BUILDER_SERVER_PORT}...`);

	// Resolve the binary explicitly — `shell: true` was previously used to
	// rely on PATH lookup, but it required /bin/sh quoting and re-parsing
	// every arg. With argv form + no shell, bun's PATH is used directly.
	const child = spawn('opencode', ['serve', '--port', String(BUILDER_SERVER_PORT)], {
		detached: true,
		stdio: 'ignore'
	});
	child.unref();
	serverPid = child.pid ?? null;

	if (serverPid) {
		try {
			writeFileSync(SERVER_PID_FILE, String(serverPid), 'utf-8');
		} catch {
			// noop
		}
	}

	// Wait for server to be ready
	const maxWait = 20_000;
	const start = Date.now();
	while (Date.now() - start < maxWait) {
		if (await isPortListening()) {
			console.log(
				`  [server] OpenCode server ready on port ${BUILDER_SERVER_PORT} (PID ${serverPid})`
			);
			serverStarted = true;
			return true;
		}
		await sleep(500);
	}

	console.error(`  [server] OpenCode server failed to start within ${maxWait}ms`);
	return false;
}

/**
 * Ensure the OpenCode server is running. Restarts it if it crashed.
 */
export async function ensureServer(): Promise<void> {
	if (serverStarted && (await isPortListening())) return;

	if (await isPortListening()) {
		console.log(`  [server] OpenCode server already running on port ${BUILDER_SERVER_PORT}`);
		serverStarted = true;
		return;
	}

	if (serverStarted) {
		console.warn(`  [server] OpenCode server crashed (was PID ${serverPid}). Restarting...`);
		killServer();
	}

	const MAX_START_RETRIES = 3;
	for (let attempt = 1; attempt <= MAX_START_RETRIES; attempt++) {
		if (await startServer()) return;
		console.warn(`  [server] Start attempt ${attempt}/${MAX_START_RETRIES} failed`);
		killServer();
	}

	throw new Error(
		`OpenCode server failed to start on port ${BUILDER_SERVER_PORT} after ${MAX_START_RETRIES} attempts. ` +
			`Verify 'opencode' is installed (\`bun install -g opencode-ai\`) and on PATH.`
	);
}

// Install lifecycle handlers so a portal restart / Ctrl+C kills the server
// (it was previously detached + unref'd with no cleanup → leaks per restart).
function installCleanupHandlers(): void {
	const handler = () => {
		if (serverPid) {
			try {
				process.kill(serverPid, 'SIGTERM');
			} catch {
				// ignore
			}
		}
	};
	process.once('exit', handler);
	process.once('SIGINT', () => {
		handler();
		// Re-raise so default behaviour (exit code) applies.
		process.exit(130);
	});
	process.once('SIGTERM', () => {
		handler();
		process.exit(143);
	});
}
installCleanupHandlers();

// ────────────────────────────────────────────────────────────────
// Agent Runner
// ────────────────────────────────────────────────────────────────

/**
 * Run an OpenCode agent with a prompt.
 */
export async function runAgent(prompt: string, options: AgentOptions): Promise<AgentResponse> {
	const { workDir, timeout = DEFAULT_TIMEOUT, sessionId } = options;

	await ensureServer();

	const serverUrl = `http://localhost:${BUILDER_SERVER_PORT}`;
	const promptPreview = prompt.substring(0, 150).replace(/\n/g, ' ');
	console.log(`  [agent] Working in: ${workDir}`);
	console.log(`  [agent] Prompt: ${promptPreview}...${prompt.length > 150 ? ` (${prompt.length} chars total)` : ''}`);
	writeHeartbeat(`agent-running`);

	// Whitelist env vars passed to OpenCode — never forward secrets that
	// don't belong to the build (the portal's SESSION_SECRET, ADO_PAT, etc.).
	const childEnv = buildChildEnv(workDir);

	try {
		const args = ['run', '--attach', serverUrl, '--dir', workDir];
		if (sessionId) {
			args.push('--session', sessionId);
		}
		args.push(prompt);
		const output = execFileSync('opencode', args, {
			cwd: workDir,
			timeout,
			encoding: 'utf-8',
			maxBuffer: 50 * 1024 * 1024,
			env: childEnv,
			stdio: ['pipe', 'pipe', 'pipe']
		});

		return {
			success: true,
			output: output.trim()
		};
	} catch (err: unknown) {
		const execErr = err as {
			stdout?: Buffer | string;
			stderr?: Buffer | string;
			message: string;
			killed?: boolean;
			signal?: string;
			code?: string | number;
		};

		const stdout = execErr.stdout?.toString() || '';
		const stderr = execErr.stderr?.toString() || '';

		if (execErr.killed || execErr.signal === 'SIGTERM') {
			console.error(`  [agent] TIMEOUT after ${timeout}ms`);
			serverStarted = false;
			return {
				success: false,
				output: stdout,
				error: `Agent timed out after ${Math.round(timeout / 1000)}s. ${stderr.slice(-2000)}`
			};
		}

		if (!(await isPortListening())) {
			console.error(`  [agent] OpenCode server died during agent execution. Will restart on next call.`);
			serverStarted = false;
		}

		return {
			success: false,
			output: stdout,
			error: stderr || execErr.message
		};
	}
}

/**
 * Build a sanitised env for OpenCode child processes.
 *
 * Drops obvious portal/host secrets that have no business inside an
 * AI-driven build (and the AI's shell tools). Preserves only what the
 * builder + AI actually need to function.
 */
function buildChildEnv(workDir: string): NodeJS.ProcessEnv {
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
		'NODE_ENV',
		'BASE_PATH',
		'OPENCODE_API_KEY',
		'OPENCODE_BUILDER_PORT',
		'BUN_INSTALL',
		'BUN_RUNTIME_TRANSPILER_CACHE_PATH',
		'PWD'
	]);
	const out: NodeJS.ProcessEnv = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (allow.has(k)) out[k] = v;
	}
	out.PWD = workDir;
	return out;
}

/**
 * Run an agent phase with retry logic.
 */
export async function runPhaseWithRetry(
	phaseName: string,
	prompt: string,
	options: AgentOptions,
	maxRetries = 2,
	onRetry?: (attempt: number, error: string) => void
): Promise<AgentResponse> {
	console.log(`\n  [${phaseName}] Starting...`);
	writeHeartbeat(phaseName);

	let currentPrompt = prompt;
	let lastError = '';

	for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
		writeHeartbeat(`${phaseName} (attempt ${attempt})`);

		try {
			await ensureServer();
		} catch (serverErr) {
			console.error(`  [${phaseName}] Cannot start OpenCode server: ${serverErr}`);
			lastError = `Server startup failed: ${serverErr}`;
			await sleep(5000);
			continue;
		}

		const result = await runAgent(currentPrompt, options);

		if (result.success) {
			console.log(`  [${phaseName}] Completed (attempt ${attempt})`);
			writeHeartbeat(`${phaseName} completed`);
			return result;
		}

		lastError = result.error || result.output;

		if (attempt <= maxRetries) {
			console.warn(`  [${phaseName}] Failed attempt ${attempt}, retrying in 5s...`);
			if (onRetry) {
				try {
					onRetry(attempt, lastError);
				} catch {
					// Caller shouldn't break the retry loop.
				}
			}
			await sleep(5000);

			const parsedErrors = parseErrors(result.error || result.output);
			const errorSummary =
				parsedErrors.length > 0
					? formatParsedErrors(parsedErrors)
					: (result.error || result.output).slice(0, 2000);

			currentPrompt = `The previous attempt to ${phaseName} failed. Fix these specific errors:

${errorSummary}

For each error:
1. Open the file mentioned
2. Go to the line number
3. Understand WHY it fails
4. Fix the root cause
5. Re-run the verify command

Then re-attempt the original task: ${prompt}`;
		} else {
			console.error(`  [${phaseName}] Failed after ${maxRetries + 1} attempts`);
			writeHeartbeat(`${phaseName} FAILED`);
			return result;
		}
	}

	return { success: false, output: '', error: lastError || 'Exhausted retries' };
}

/**
 * Parse raw build/test output into structured error items.
 */
export function parseErrors(rawOutput: string): { file: string; line: number; message: string }[] {
	const errors: { file: string; line: number; message: string }[] = [];
	const seen = new Set<string>();

	const lines = rawOutput.split('\n');
	for (const line of lines) {
		// TypeScript / SvelteCheck errors: src/path/file.ts:42:5 - error TS2304: Cannot find name
		const tsMatch = line.match(/(src\/[^:]+):(\d+):\d+\s*-\s*error\s+\w+:\s*(.+)/);
		if (tsMatch) {
			const key = `${tsMatch[1]}:${tsMatch[2]}`;
			if (!seen.has(key)) {
				seen.add(key);
				errors.push({ file: tsMatch[1], line: parseInt(tsMatch[2]), message: tsMatch[3].trim() });
			}
			continue;
		}

		// Vite build errors: ERROR  src/path/file.svelte:42:5 ...
		const viteMatch = line.match(/ERROR\s+(src\/[^:]+):(\d+):\d+\s*(.*)/);
		if (viteMatch) {
			const key = `${viteMatch[1]}:${viteMatch[2]}`;
			if (!seen.has(key)) {
				seen.add(key);
				errors.push({ file: viteMatch[1], line: parseInt(viteMatch[2]), message: viteMatch[3].trim() });
			}
			continue;
		}

		// Vitest failures: FAIL src/lib/server/service.test.ts > describe > test name
		const vitestMatch = line.match(/FAIL\s+(src\/[^\s>]+)/);
		if (vitestMatch) {
			const key = vitestMatch[1];
			if (!seen.has(key)) {
				seen.add(key);
				errors.push({ file: vitestMatch[1], line: 0, message: `Test failure in ${vitestMatch[1]}` });
			}
			continue;
		}

		// Svelte compile errors: Error compiling component at src/...
		const svelteMatch = line.match(/Error\s+(?:compiling|in)\s+(?:component\s+)?(?:at\s+)?(src\/[^\s]+)/);
		if (svelteMatch) {
			const key = svelteMatch[1];
			if (!seen.has(key)) {
				seen.add(key);
				errors.push({ file: svelteMatch[1], line: 0, message: line.trim() });
			}
		}
	}

	return errors;
}

export function formatParsedErrors(errors: { file: string; line: number; message: string }[]): string {
	if (errors.length === 0) return 'No specific errors parsed from output.';
	return errors
		.map((e, i) => `${i + 1}. ${e.file}${e.line > 0 ? `:${e.line}` : ''} — ${e.message}`)
		.join('\n');
}

/**
 * Result of running a shell command — exposes captured output even on failure.
 */
export interface ShellResult {
	stdout: string;
	stderr: string;
	combined: string;
}

/**
 * Run a shell command in a workspace directory.
 *
 * Returns the trimmed stdout on success. On failure, throws an error
 * whose `.message` includes the exit code AND a tail of stderr+stdout
 * (the previous version threw a bare `Command failed: <cmd>` with no
 * captured output, making every "exited with code 1" un-diagnosable).
 *
 * The captured combined output is also exposed as `err.combinedOutput`
 * for callers that want to surface it via logBuildPhase.
 */
export function runShell(command: string, workDir: string, timeout = 120_000): string {
	try {
		const stdout = execSync(command, {
			cwd: workDir,
			timeout,
			encoding: 'utf-8',
			maxBuffer: 10 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'pipe']
		});
		return (stdout ?? '').toString().trim();
	} catch (err: unknown) {
		const e = err as {
			message: string;
			stdout?: Buffer | string;
			stderr?: Buffer | string;
			status?: number | null;
			signal?: string;
			code?: string | number;
		};
		const stdout = e.stdout?.toString() || '';
		const stderr = e.stderr?.toString() || '';
		const combined = `${stdout}${stdout && stderr ? '\n' : ''}${stderr}`.trim();
		const tail = combined.slice(-3000);
		const codePart =
			typeof e.status === 'number'
				? `exit ${e.status}`
				: e.signal
					? `signal ${e.signal}`
					: e.code
						? `code ${e.code}`
						: 'failed';
		const msg = `Command failed (${codePart}): ${command}\n${tail || '(no output captured)'}`;
		const wrapped = new Error(msg) as Error & {
			stdout: string;
			stderr: string;
			combinedOutput: string;
			exitStatus: number | null;
			command: string;
		};
		wrapped.stdout = stdout;
		wrapped.stderr = stderr;
		wrapped.combinedOutput = combined;
		wrapped.exitStatus = typeof e.status === 'number' ? e.status : null;
		wrapped.command = command;
		throw wrapped;
	}
}

/**
 * Run a shell command and return a structured result regardless of outcome.
 * Useful when callers want both stdout and stderr without the throw/catch dance.
 */
export function runShellCaptured(
	command: string,
	workDir: string,
	timeout = 120_000
): { ok: boolean; result: ShellResult; exitStatus: number | null } {
	try {
		const stdout = runShell(command, workDir, timeout);
		return {
			ok: true,
			result: { stdout, stderr: '', combined: stdout },
			exitStatus: 0
		};
	} catch (err) {
		const e = err as Error & {
			stdout?: string;
			stderr?: string;
			combinedOutput?: string;
			exitStatus?: number | null;
		};
		return {
			ok: false,
			result: {
				stdout: e.stdout ?? '',
				stderr: e.stderr ?? e.message,
				combined: e.combinedOutput ?? `${e.stdout ?? ''}\n${e.stderr ?? e.message}`
			},
			exitStatus: e.exitStatus ?? null
		};
	}
}

/**
 * Verify a build layer by running a command and checking exit code.
 *
 * Returns `{ passed, output }` so the caller can persist `output` to the
 * buildLog when verification fails (the previous bool-only return forced
 * every caller to either re-run the command or lose the error context).
 */
export function verifyLayer(
	name: string,
	command: string,
	workDir: string
): { passed: boolean; output: string } {
	console.log(`  [verify:${name}] Running: ${command}`);
	writeHeartbeat(`verify:${name}`);
	const captured = runShellCaptured(command, workDir, 120_000);
	if (captured.ok) {
		console.log(`  [verify:${name}] PASSED`);
		return { passed: true, output: captured.result.combined };
	}
	const tail = captured.result.combined.slice(-2000);
	console.error(`  [verify:${name}] FAILED (exit ${captured.exitStatus}):\n${tail}`);
	return { passed: false, output: captured.result.combined };
}

/**
 * Backwards-compat wrapper: returns a boolean. New callers should use
 * the structured `verifyLayer()` above and persist `output` on failure.
 */
export function verifyLayerBool(name: string, command: string, workDir: string): boolean {
	return verifyLayer(name, command, workDir).passed;
}
