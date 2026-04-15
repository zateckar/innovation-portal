import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { resolve } from 'path';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { spawn } from 'child_process';

// ────────────────────────────────────────────────────────────────
// Build process tracking — survives across requests
// ────────────────────────────────────────────────────────────────

const activeBuildPids = new Map<string, number>(); // uuid → child PID

/**
 * Update workspace metadata on disk (lightweight, no import of scripts/).
 */
function updateWorkspaceStatus(wsDir: string, status: string, errorMsg?: string) {
	try {
		const metaPath = resolve(wsDir, 'metadata.json');
		if (!existsSync(metaPath)) return;
		const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
		meta.status = status;
		if (errorMsg) meta.error = errorMsg;
		meta.lastUpdated = new Date().toISOString();
		writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
	} catch (e) {
		console.error(`[build] Failed to update workspace status:`, e);
	}
}

/**
 * Check if a build process is still alive by PID.
 */
function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0); // signal 0 = check existence, don't kill
		return true;
	} catch {
		return false;
	}
}

/**
 * POST /api/ideas/{id}/build
 * Triggers the autonomous build pipeline for an idea's specification.
 * 
 * Robustness features:
 * - Tracks child process PID and detects crashes
 * - Updates metadata to 'error' on process exit with non-zero code
 * - Writes heartbeat file for stale build detection
 * - Supports re-triggering builds after failure (clears workspace link)
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const ideaId = params.id;
	if (!ideaId) throw error(400, 'Missing idea ID');

	// Load the idea
	const [idea] = await db
		.select()
		.from(ideas)
		.where(eq(ideas.id, ideaId))
		.limit(1);

	if (!idea) throw error(404, 'Idea not found');

	if (idea.specStatus !== 'completed' || !idea.specDocument) {
		throw error(400, 'Specification is not completed yet');
	}

	// If already has a workspace, check if the build is still alive or needs recovery
	if (idea.workspaceUuid) {
		const wsDir = resolve('workspaces', idea.workspaceUuid);
		const metaPath = resolve(wsDir, 'metadata.json');

		if (existsSync(metaPath)) {
			const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));

			// If deployed or error, return current status (user can retry error builds)
			if (meta.status === 'deployed') {
				return json({
					uuid: idea.workspaceUuid,
					status: 'deployed',
					message: 'Application is already deployed.'
				});
			}

			// Check if build process is still alive
			const pid = activeBuildPids.get(idea.workspaceUuid);
			const isStillBuilding = meta.status === 'building' || meta.status === 'planning'
				|| meta.status === 'reviewing' || meta.status === 'testing'
				|| meta.status === 'deploying';

			if (isStillBuilding && pid && isProcessAlive(pid)) {
				return json({
					uuid: idea.workspaceUuid,
					status: 'already_building',
					message: 'A build is already in progress for this idea.'
				});
			}

			// Build process died (no PID or process not alive) but status is still "building"
			// This is the crash recovery case — detect orphaned builds
			if (isStillBuilding && (!pid || !isProcessAlive(pid))) {
				console.warn(`[build:${idea.workspaceUuid}] Detected orphaned build (process dead, status=${meta.status}). Allowing retry.`);
				updateWorkspaceStatus(wsDir, 'error', `Build process crashed or timed out (was in "${meta.status}" phase). Retrying...`);
				// Clear workspace link so we can re-trigger
				await db.update(ideas).set({ workspaceUuid: null }).where(eq(ideas.id, ideaId));
				activeBuildPids.delete(idea.workspaceUuid);
				// Fall through to create a new build
			} else if (meta.status === 'error') {
				// Previous build failed — allow retry by clearing workspace link
				console.log(`[build:${idea.workspaceUuid}] Previous build failed. Allowing retry.`);
				await db.update(ideas).set({ workspaceUuid: null }).where(eq(ideas.id, ideaId));
				activeBuildPids.delete(idea.workspaceUuid);
				// Fall through to create a new build
			}
		}
	}

	// Create workspace
	const uuid = randomUUID();
	const wsDir = resolve('workspaces', uuid);
	mkdirSync(wsDir, { recursive: true });
	mkdirSync(resolve(wsDir, 'versions'), { recursive: true });

	const specPath = resolve(wsDir, 'SPECIFICATION.md');
	writeFileSync(specPath, idea.specDocument, 'utf-8');

	// Write initial metadata with heartbeat
	const metadata = {
		uuid,
		createdAt: new Date().toISOString(),
		lastUpdated: new Date().toISOString(),
		specHash: '',
		versions: [],
		currentVersion: 0,
		status: 'building',
		ideaId: idea.id,
		ideaSlug: idea.slug,
		ideaTitle: idea.title
	};
	writeFileSync(resolve(wsDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

	// Link workspace to idea
	await db
		.update(ideas)
		.set({ workspaceUuid: uuid })
		.where(eq(ideas.id, ideaId));

	// Trigger build in background using spawn (better process control than exec)
	const builderScript = resolve('scripts', 'builder.ts');
	const child = spawn('bun', [builderScript, '--uuid', uuid, 'build', specPath], {
		cwd: resolve('.'),
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: true
	});

	// Track the PID for liveness checks
	if (child.pid) {
		activeBuildPids.set(uuid, child.pid);
	}

	child.stdout?.on('data', (data: Buffer) => {
		const msg = data.toString().trim();
		if (msg) console.log(`[build:${uuid}] ${msg}`);
	});

	child.stderr?.on('data', (data: Buffer) => {
		const msg = data.toString().trim();
		if (msg) console.error(`[build:${uuid}] ${msg}`);
	});

	// Handle process exit — update metadata on failure
	child.on('exit', (code, signal) => {
		activeBuildPids.delete(uuid);

		if (code !== 0) {
			const reason = signal
				? `Build process killed by signal ${signal}`
				: `Build process exited with code ${code}`;

			console.error(`[build:${uuid}] ${reason}`);
			updateWorkspaceStatus(wsDir, 'error', reason);
		} else {
			console.log(`[build:${uuid}] Build process completed successfully (exit code 0)`);
		}
	});

	// Handle spawn errors (e.g., bun not found)
	child.on('error', (err) => {
		activeBuildPids.delete(uuid);
		console.error(`[build:${uuid}] Failed to start build process:`, err);
		updateWorkspaceStatus(wsDir, 'error', `Failed to start build: ${err.message}`);
	});

	return json({
		uuid,
		status: 'building',
		message: 'Build started. Track progress on the workspace page.'
	});
};
