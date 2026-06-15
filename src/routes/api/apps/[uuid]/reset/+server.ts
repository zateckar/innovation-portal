import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve, join } from 'path';
import { existsSync, readdirSync, rmSync } from 'fs';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	spawnBuilder,
	isValidUuid,
	peekMetadata,
	isPidAlive,
	workspaceDir,
	writeDesignReference
} from '$lib/server/services/buildLauncher';
import {
	stopWorkspaceProcess,
	resetWorkspaceCrashCount
} from '$lib/server/services/workspaceProcessManager';
import { updateMetadataAtomic, appendBuildLogEntry } from '../../../../../../scripts/metadata-store';
import type { SpecMockupSet } from '$lib/types';

const WORKSPACES_ROOT = resolve('workspaces');

/** List deployed/built version numbers for a workspace. */
function listVersions(uuid: string): number[] {
	const dir = resolve(WORKSPACES_ROOT, uuid, 'versions');
	if (!existsSync(dir)) return [];
	try {
		return readdirSync(dir)
			.filter((d) => /^v\d+$/.test(d))
			.map((d) => parseInt(d.slice(1), 10))
			.filter((n) => Number.isInteger(n) && n > 0);
	} catch {
		return [];
	}
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/apps/{uuid}/reset
 *
 * Force-recover a workspace from ANY broken state and (optionally) start a
 * fresh rebuild. This is the escape hatch for situations the narrower
 * /build and /rebuild endpoints refuse to touch:
 *
 *   - A build hung with its PID still alive (rebuild returns 409).
 *   - The app reports status "deployed" but every request 503s because the
 *     workspace process won't start (build short-circuits on "deployed").
 *   - A crashed/orphaned build that left stale state behind.
 *
 * Steps: force-kill any live build process → wait for it to die → stop the
 * running workspace processes and clear crash counters → drop any leftover
 * autofix temp spec → reset metadata to a clean state → spawn a rebuild.
 *
 * Body: { rebuild?: boolean } — default true. Pass false to only clear the
 * broken state without immediately starting a new build.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const { uuid } = params;
	if (!isValidUuid(uuid)) {
		throw error(400, 'Invalid UUID');
	}

	const wsDir = workspaceDir(uuid);
	if (!existsSync(wsDir)) {
		throw error(404, 'Workspace not found');
	}

	const specPath = resolve(wsDir, 'SPECIFICATION.md');
	if (!existsSync(specPath)) {
		throw error(400, 'No specification found');
	}

	// Ownership: admins always allowed; non-admins must be the proposer.
	if (locals.user.role !== 'admin') {
		const [linked] = await db
			.select({ proposedBy: ideas.proposedBy })
			.from(ideas)
			.where(eq(ideas.workspaceUuid, uuid))
			.limit(1);
		if (!linked || linked.proposedBy !== locals.user.id) {
			throw error(403, 'Not authorized to reset this application');
		}
	}

	const body = (await request.json().catch(() => ({}))) as { rebuild?: boolean };
	const shouldRebuild = body.rebuild !== false; // default true

	await appendBuildLogEntry(uuid, 'Build Reset', 'Manual reset requested by user', 'info');

	// 1. Force-kill any live build process and wait for it to actually die so
	//    its terminal metadata write lands BEFORE ours (avoids a status race).
	const meta = peekMetadata(uuid);
	const buildPid =
		typeof meta?.buildPid === 'number' && meta.buildPid > 0 ? meta.buildPid : null;
	if (buildPid && isPidAlive(buildPid)) {
		try {
			process.kill(buildPid, 'SIGTERM');
		} catch {
			/* already gone */
		}
		// Wait up to ~6s for graceful exit, then escalate to SIGKILL.
		for (let i = 0; i < 30 && isPidAlive(buildPid); i++) await sleep(200);
		if (isPidAlive(buildPid)) {
			try {
				process.kill(buildPid, 'SIGKILL');
			} catch {
				/* ignore */
			}
			for (let i = 0; i < 15 && isPidAlive(buildPid); i++) await sleep(200);
		}
	}

	// 2. Stop every running workspace process for this uuid and clear the
	//    crash backoff so the rebuilt version can start cleanly.
	for (const v of listVersions(uuid)) {
		try {
			stopWorkspaceProcess(uuid, v);
			resetWorkspaceCrashCount(uuid, v);
		} catch {
			/* best-effort */
		}
	}

	// 3. Drop any leftover autofix temp spec so a rebuild uses the clean spec.
	try {
		rmSync(join(wsDir, 'SPECIFICATION.fix.md'), { force: true });
	} catch {
		/* ignore */
	}

	// 4. Reset metadata to a clean, recoverable state.
	await updateMetadataAtomic(uuid, (m) => {
		m.buildPid = null;
		m.autofixAttempts = 0;
		if (shouldRebuild) {
			m.status = 'building';
			m.error = undefined;
			m.currentPhase = 'Reset: Restarting build';
		} else {
			m.status = 'error';
			m.error = 'Build was reset. Trigger a rebuild to try again.';
		}
		return m;
	});

	if (!shouldRebuild) {
		return json({ status: 'reset', message: 'Build state reset. Trigger a rebuild when ready.' });
	}

	// 5. Refresh the design reference from the latest approved mockups
	//    (best-effort, never fatal) and spawn a fresh rebuild.
	try {
		const [linkedIdea] = await db
			.select({ specMockups: ideas.specMockups })
			.from(ideas)
			.where(eq(ideas.workspaceUuid, uuid))
			.limit(1);
		if (linkedIdea) {
			const mockups = linkedIdea.specMockups
				? (JSON.parse(linkedIdea.specMockups) as SpecMockupSet)
				: null;
			writeDesignReference(uuid, mockups);
		}
	} catch (err) {
		console.warn(`[reset:${uuid}] Failed to refresh design reference:`, err);
	}

	spawnBuilder(uuid, ['rebuild', uuid, specPath]);

	return json({
		status: 'rebuilding',
		message: 'Build reset and a fresh rebuild has been started.'
	});
};
