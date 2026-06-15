/**
 * Build Launcher
 *
 * Shared helpers used by the /build, /rebuild, and /autofix API
 * endpoints to spawn the autonomous builder safely.
 *
 * Centralises:
 *   - Argv-based spawning (NEVER `shell: true` + interpolated strings)
 *   - PID persistence into metadata.json (atomically) so orphan
 *     detection works after a portal restart
 *   - Per-build log file capture (stdio piped to disk for post-mortem)
 *   - Sanitised env propagation (BASE_PATH per-spawn, no global mutation)
 *
 * UUID validation lives here too so every endpoint shares one regex.
 */
import { spawn, type ChildProcess } from 'child_process';
import { createWriteStream, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import {
	updateMetadataAtomic,
	appendBuildLogEntry,
	clampLastError
} from '../../../../scripts/metadata-store.ts';
import type { SpecMockupSet } from '$lib/types';

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidUuid(uuid: string | null | undefined): uuid is string {
	return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}

export function isValidVersion(version: unknown): version is number {
	return typeof version === 'number' && Number.isInteger(version) && version >= 1 && version <= 9999;
}

export function workspaceDir(uuid: string): string {
	return resolve('workspaces', uuid);
}

export function builderScriptPath(): string {
	return resolve('scripts', 'builder.ts');
}

/**
 * Write stakeholder-approved screen mockups into the workspace ROOT as a
 * design reference the builder stages into each build/rebuild. Produces:
 *   - design/NN-<slug>.html   (one approved mockup per screen)
 *   - DESIGN_REFERENCE.md      (index the AI reads first)
 *
 * No-op (and cleans up any stale reference) when there are no mockups, so a
 * build never inherits a previous run's designs after they were removed.
 */
export function writeDesignReference(uuid: string, mockups: SpecMockupSet | null): void {
	const wsDir = workspaceDir(uuid);
	const designDir = join(wsDir, 'design');
	const indexPath = join(wsDir, 'DESIGN_REFERENCE.md');

	if (!mockups || mockups.screens.length === 0) {
		try { rmSync(designDir, { recursive: true, force: true }); } catch { /* ignore */ }
		try { rmSync(indexPath, { force: true }); } catch { /* ignore */ }
		return;
	}

	mkdirSync(designDir, { recursive: true });

	const lines: string[] = [
		'# Design Reference — Approved Screen Mockups',
		'',
		'These HTML mockups were reviewed and approved by the business stakeholders.',
		'They are the source of truth for how each screen should LOOK. Reproduce their',
		'layout, sections, components, labels and visual hierarchy using the project\'s',
		'Svelte 5 + TailwindCSS components wired to real data. Do not paste raw mockup HTML.',
		'',
		'| # | Screen | Purpose | Mockup file |',
		'|---|--------|---------|-------------|'
	];

	mockups.screens.forEach((screen, i) => {
		const n = String(i + 1).padStart(2, '0');
		const slug =
			(screen.screenName || `screen-${i + 1}`)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/(^-|-$)/g, '')
				.slice(0, 40) || `screen-${i + 1}`;
		const file = `${n}-${slug}.html`;
		try {
			writeFileSync(join(designDir, file), screen.html ?? '', 'utf-8');
			lines.push(`| ${i + 1} | ${screen.screenName} | ${(screen.purpose ?? '').replace(/\|/g, '/')} | design/${file} |`);
		} catch {
			/* skip a screen that fails to write rather than failing the build */
		}
	});

	try {
		writeFileSync(indexPath, lines.join('\n') + '\n', 'utf-8');
	} catch {
		/* non-fatal: build proceeds without the design reference */
	}
}

/**
 * Whitelist env passed to the builder subprocess.
 *
 * The builder needs PATH, BUN_*, OPENCODE_API_KEY, ADO_PAT (for git),
 * and a few system vars. It must NOT inherit SESSION_SECRET or other
 * portal-only secrets — those flow into the AI's `process.env` and
 * end up readable by every workspace child app.
 */
export function buildBuilderEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
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
		'NODE_ENV',
		'BUN_INSTALL',
		'BUN_RUNTIME_TRANSPILER_CACHE_PATH',
		'OPENCODE_API_KEY',
		'OPENCODE_BUILDER_PORT',
		'GEMINI_API_KEY', // OpenCode + AI agents legitimately need this
		'ADO_PAT',
		'ADO_ORG_URL',
		'ADO_PROJECT'
	]);
	const out: NodeJS.ProcessEnv = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (allow.has(k)) out[k] = v;
	}
	for (const [k, v] of Object.entries(extra)) {
		out[k] = v;
	}
	return out;
}

export interface SpawnedBuilder {
	child: ChildProcess;
	pid: number | undefined;
	logPath: string;
}

/**
 * Spawn the builder with safe defaults.
 *
 * - `shell: false` (argv array, no PATH metachar parsing)
 * - stdout/stderr piped to a per-build file under workspaces/<uuid>/builds/
 * - env sanitised via `buildBuilderEnv`
 * - on exit, persists the exit code + last 8 KB of stderr into metadata
 *   atomically so the UI can show "what actually failed" instead of the
 *   generic "exited with code 1"
 */
export function spawnBuilder(
	uuid: string,
	args: string[],
	extraEnv: Record<string, string> = {}
): SpawnedBuilder {
	const wsDir = workspaceDir(uuid);
	const buildsDir = join(wsDir, 'builds');
	mkdirSync(buildsDir, { recursive: true });
	const logPath = join(buildsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`);
	const logStream = createWriteStream(logPath, { flags: 'a' });

	const child = spawn('bun', [builderScriptPath(), ...args], {
		cwd: resolve('.'),
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: false, // CRITICAL: never reintroduce shell:true here
		env: buildBuilderEnv(extraEnv)
	});

	// Capture both streams to disk and to console (with rate-limited tail buffer).
	const tailBuf = { text: '' };
	const TAIL_LIMIT = 8192;
	const onChunk = (label: string) => (data: Buffer) => {
		const text = data.toString();
		try {
			logStream.write(text);
		} catch {
			// noop
		}
		// Keep the most recent ~8 KB in memory for the exit handler.
		tailBuf.text = (tailBuf.text + text).slice(-TAIL_LIMIT);
		const trimmed = text.trim();
		if (trimmed) {
			if (label === 'ERR') console.error(`[build:${uuid}] ${trimmed}`);
			else console.log(`[build:${uuid}] ${trimmed}`);
		}
	};
	child.stdout?.on('data', onChunk('OUT'));
	child.stderr?.on('data', onChunk('ERR'));

	const startedAt = new Date().toISOString();
	void updateMetadataAtomic(uuid, (m) => {
		m.buildPid = child.pid ?? null;
		m.buildStartedAt = startedAt;
		return m;
	});

	child.on('exit', (code, signal) => {
		try {
			logStream.end();
		} catch {
			// noop
		}
		void updateMetadataAtomic(uuid, (m) => {
			m.buildPid = null;
			if (code !== 0) {
				const reason = signal
					? `Build process killed by signal ${signal}`
					: `Build process exited with code ${code}`;
				m.status = 'error';
				m.error = reason;
				if (tailBuf.text.trim()) {
					m.lastErrorOutput = clampLastError(tailBuf.text);
				}
			}
			return m;
		});
		void appendBuildLogEntry(
			uuid,
			'Build Process',
			code === 0
				? 'Build process exited cleanly (code 0)'
				: `Build process exited with code ${code}${signal ? ` (signal ${signal})` : ''}`,
			code === 0 ? 'completed' : 'error'
		);
	});

	child.on('error', (err) => {
		void appendBuildLogEntry(uuid, 'Build Process', `Spawn error: ${err.message}`, 'error');
		void updateMetadataAtomic(uuid, (m) => {
			m.buildPid = null;
			m.status = 'error';
			m.error = `Failed to start build: ${err.message}`;
			return m;
		});
	});

	return { child, pid: child.pid, logPath };
}

export function isPidAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

export interface MetadataPeek {
	status?: string;
	buildPid?: number | null;
	autofixAttempts?: number;
	autofixHistory?: Array<{ attempt: number; at: string; errors: string }>;
	error?: string;
}

/** Lightweight metadata.json read for endpoint preconditions. */
export function peekMetadata(uuid: string): MetadataPeek | null {
	const p = join(workspaceDir(uuid), 'metadata.json');
	if (!existsSync(p)) return null;
	try {
		return JSON.parse(readFileSync(p, 'utf-8')) as MetadataPeek;
	} catch {
		return null;
	}
}
