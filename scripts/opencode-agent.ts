import { execSync, execFileSync, spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

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
}

const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const BUILDER_SERVER_PORT = 14567; // Dedicated port for builder's OpenCode server

// ────────────────────────────────────────────────────────────────
// Heartbeat — write progress to disk so external watchers can
// detect stalled builds
// ────────────────────────────────────────────────────────────────

let heartbeatPath: string | null = null;

/**
 * Set the heartbeat file path. Called by the builder at startup
 * so each phase writes a timestamp + phase name.
 */
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
		writeFileSync(heartbeatPath, data, 'utf-8');
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
 * Check if the OpenCode server port is actually listening.
 * Works on both Windows and Linux (containers).
 */
function isPortListening(): boolean {
	try {
		if (isWindows) {
			const netstat = execSync('netstat -an', { encoding: 'utf-8', timeout: 5000 });
			return netstat.includes(`:${BUILDER_SERVER_PORT}`) && netstat.includes('LISTENING');
		} else {
			// Linux: use /proc/net/tcp or ss
			try {
				const ss = execSync(`ss -tlnH sport = :${BUILDER_SERVER_PORT}`, { encoding: 'utf-8', timeout: 5000 });
				return ss.trim().length > 0;
			} catch {
				// Fallback: try connecting to the port via bun
				try {
					execSync(
						`bun --eval "const s=require('net').connect(${BUILDER_SERVER_PORT},'127.0.0.1');s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))"`,
						{ timeout: 3000 }
					);
					return true;
				} catch {
					return false;
				}
			}
		}
	} catch {
		return false;
	}
}

/**
 * Check if a process is alive by PID.
 */
function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Kill the OpenCode server if it's running (for restart).
 */
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
}

/**
 * Start the OpenCode server and wait for it to be ready.
 * Returns true if server is ready, false if it failed to start.
 */
function startServer(): boolean {
	console.log(`  [server] Starting headless OpenCode server on port ${BUILDER_SERVER_PORT}...`);

	const child = spawn('opencode', ['serve', '--port', String(BUILDER_SERVER_PORT)], {
		detached: true,
		stdio: 'ignore',
		shell: true
	});
	child.unref();
	serverPid = child.pid ?? null;

	// Wait for server to be ready
	const maxWait = 20_000;
	const start = Date.now();
	while (Date.now() - start < maxWait) {
		if (isPortListening()) {
			console.log(`  [server] OpenCode server ready on port ${BUILDER_SERVER_PORT} (PID ${serverPid})`);
			serverStarted = true;
			return true;
		}
		// Busy wait 500ms
		try { execSync('sleep 0.5', { timeout: 1000 }); } catch { /* ignore */ }
	}

	console.error(`  [server] OpenCode server failed to start within ${maxWait}ms`);
	return false;
}

/**
 * Ensure a dedicated headless OpenCode server is running on BUILDER_SERVER_PORT.
 * Performs actual health checks — doesn't trust the in-memory flag alone.
 * Automatically restarts the server if it has crashed.
 */
export function ensureServer(): void {
	// Fast path: we think it's started, verify it's still listening
	if (serverStarted && isPortListening()) {
		return;
	}

	// Server might have crashed — check if port is listening (started by another process)
	if (isPortListening()) {
		console.log(`  [server] OpenCode server already running on port ${BUILDER_SERVER_PORT}`);
		serverStarted = true;
		return;
	}

	// Server is down. If we had a PID, it crashed.
	if (serverStarted) {
		console.warn(`  [server] OpenCode server crashed (was PID ${serverPid}). Restarting...`);
		killServer();
	}

	// Try to start the server, with retries
	const MAX_START_RETRIES = 3;
	for (let attempt = 1; attempt <= MAX_START_RETRIES; attempt++) {
		if (startServer()) return;
		console.warn(`  [server] Start attempt ${attempt}/${MAX_START_RETRIES} failed`);
		killServer(); // Clean up before retry
	}

	throw new Error(
		`OpenCode server failed to start on port ${BUILDER_SERVER_PORT} after ${MAX_START_RETRIES} attempts`
	);
}

// ────────────────────────────────────────────────────────────────
// Agent Runner — with server health verification
// ────────────────────────────────────────────────────────────────

/**
 * Run an OpenCode agent with a prompt, working in a specific directory.
 * Uses `opencode run --attach` to connect to the dedicated builder server.
 * 
 * Robustness:
 * - Verifies server is alive before each call
 * - Restarts server if it crashed between calls
 * - Writes heartbeat for external monitoring
 * - Captures both stdout and stderr for diagnostics
 */
export async function runAgent(prompt: string, options: AgentOptions): Promise<AgentResponse> {
	const { workDir, timeout = DEFAULT_TIMEOUT } = options;

	// Verify server is alive (restarts if crashed)
	ensureServer();

	const serverUrl = `http://localhost:${BUILDER_SERVER_PORT}`;

	console.log(`  [agent] Working in: ${workDir}`);
	console.log(`  [agent] Prompt: ${prompt.substring(0, 150).replace(/\n/g, ' ')}...`);
	writeHeartbeat(`agent-running`);

	try {
		const output = execFileSync(
			'opencode',
			['run', '--attach', serverUrl, '--dir', workDir, prompt],
			{
				cwd: workDir,
				timeout,
				encoding: 'utf-8',
				maxBuffer: 50 * 1024 * 1024,
				env: { ...process.env },
				stdio: ['pipe', 'pipe', 'pipe']
			}
		);

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

		// Detect if this was a timeout
		if (execErr.killed || execErr.signal === 'SIGTERM') {
			console.error(`  [agent] TIMEOUT after ${timeout}ms`);
			// Server might be in a bad state after timeout — force restart on next call
			serverStarted = false;
			return {
				success: false,
				output: execErr.stdout?.toString() || '',
				error: `Agent timed out after ${Math.round(timeout / 1000)}s. ${execErr.stderr?.toString() || ''}`
			};
		}

		// Detect if the server crashed during the call
		if (!isPortListening()) {
			console.error(`  [agent] OpenCode server died during agent execution. Will restart on next call.`);
			serverStarted = false;
		}

		return {
			success: false,
			output: execErr.stdout?.toString() || '',
			error: execErr.stderr?.toString() || execErr.message
		};
	}
}

/**
 * Run an agent phase with retry logic.
 * Retries up to maxRetries times on failure, with a fix-focused retry prompt.
 * 
 * Robustness:
 * - Writes heartbeat before each attempt
 * - Detects and recovers from server crashes between retries
 * - Logs all failures for post-mortem analysis
 */
export async function runPhaseWithRetry(
	phaseName: string,
	prompt: string,
	options: AgentOptions,
	maxRetries = 2
): Promise<AgentResponse> {
	console.log(`\n  [${phaseName}] Starting...`);
	writeHeartbeat(phaseName);

	let currentPrompt = prompt;
	let lastError = '';

	for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
		writeHeartbeat(`${phaseName} (attempt ${attempt})`);

		// Verify server health before each attempt (auto-restart if crashed)
		try {
			ensureServer();
		} catch (serverErr) {
			console.error(`  [${phaseName}] Cannot start OpenCode server: ${serverErr}`);
			lastError = `Server startup failed: ${serverErr}`;
			// Wait before retry
			await new Promise(r => setTimeout(r, 5000));
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

			// Brief cooldown before retry (gives server time to recover)
			await new Promise(r => setTimeout(r, 5000));

			const parsedErrors = parseErrors(result.error || result.output);
			const errorSummary = parsedErrors.length > 0
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
 * Extracts file paths, line numbers, and error messages from:
 * - TypeScript errors: src/routes/+page.svelte:42:5 - error TS2304: ...
 * - Svelte errors: Error compiling ... 
 * - Vitest failures: FAIL src/lib/server/...
 * - Generic Node errors: Error: ...
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

/**
 * Format parsed errors into a concise prompt-ready string.
 */
export function formatParsedErrors(errors: { file: string; line: number; message: string }[]): string {
	if (errors.length === 0) return 'No specific errors parsed from output.';
	return errors.map((e, i) => 
		`${i + 1}. ${e.file}${e.line > 0 ? `:${e.line}` : ''} — ${e.message}`
	).join('\n');
}

/**
 * Run a shell command in a workspace directory.
 */
export function runShell(command: string, workDir: string, timeout = 120_000): string {
	return execSync(command, {
		cwd: workDir,
		timeout,
		encoding: 'utf-8',
		maxBuffer: 10 * 1024 * 1024
	}).trim();
}

/**
 * Verify a build layer by running a command and checking exit code.
 */
export function verifyLayer(name: string, command: string, workDir: string): boolean {
	console.log(`  [verify:${name}] Running: ${command}`);
	writeHeartbeat(`verify:${name}`);
	try {
		runShell(command, workDir, 120_000);
		console.log(`  [verify:${name}] PASSED`);
		return true;
	} catch (err: unknown) {
		const execErr = err as { message: string };
		console.error(`  [verify:${name}] FAILED: ${execErr.message}`);
		return false;
	}
}
