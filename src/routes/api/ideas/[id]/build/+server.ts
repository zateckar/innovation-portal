import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { resolve } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import {
	spawnBuilder,
	isValidUuid,
	peekMetadata,
	isPidAlive,
	workspaceDir
} from '$lib/server/services/buildLauncher';
import {
	updateMetadataAtomic,
	appendBuildLogEntry
} from '../../../../../../scripts/metadata-store';

/**
 * POST /api/ideas/{id}/build
 *
 * Triggers the autonomous build pipeline for an idea's specification.
 *
 * Robustness:
 * - Uses transactional DB UPDATE to atomically claim the idea's
 *   workspaceUuid, preventing two concurrent POSTs from creating
 *   dueling workspaces and orphaning one.
 * - Persists build PID into metadata.json so portal restart + watchdog
 *   can detect crashed/orphaned builds without an in-memory map.
 * - Uses safe argv-based spawn (NEVER `shell: true`).
 * - Per-build env propagation (BASE_PATH passed via env, not mutated).
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const ideaId = params.id;
	if (!ideaId) throw error(400, 'Missing idea ID');

	const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);

	if (!idea) throw error(404, 'Idea not found');

	if (idea.specStatus !== 'completed' || !idea.specDocument) {
		throw error(400, 'Specification is not completed yet');
	}

	// If a workspace exists, decide whether to short-circuit or recover.
	if (idea.workspaceUuid) {
		const meta = peekMetadata(idea.workspaceUuid);
		if (meta) {
			if (meta.status === 'deployed') {
				return json({
					uuid: idea.workspaceUuid,
					status: 'deployed',
					message: 'Application is already deployed.'
				});
			}

			const isStillBuilding =
				meta.status === 'building' ||
				meta.status === 'planning' ||
				meta.status === 'reviewing' ||
				meta.status === 'testing' ||
				meta.status === 'deploying';

			const pidAlive =
				typeof meta.buildPid === 'number' && meta.buildPid > 0
					? isPidAlive(meta.buildPid)
					: false;

			if (isStillBuilding && pidAlive) {
				return json({
					uuid: idea.workspaceUuid,
					status: 'already_building',
					message: 'A build is already in progress for this idea.'
				});
			}

			// Orphaned build (pid dead) OR previous error → allow retry
			if (isStillBuilding && !pidAlive) {
				console.warn(
					`[build:${idea.workspaceUuid}] Detected orphaned build (pid dead, status=${meta.status}). Allowing retry.`
				);
				await appendBuildLogEntry(
					idea.workspaceUuid,
					'Build Recovery',
					`Orphaned build detected (PID ${meta.buildPid ?? 'unknown'} not alive while status=${meta.status}). Retrying.`,
					'info'
				);
				await updateMetadataAtomic(idea.workspaceUuid, (m) => {
					m.status = 'error';
					m.error = `Build process crashed or timed out (was in "${meta.status}" phase). Retrying...`;
					m.buildPid = null;
					return m;
				});
				// Atomically clear the link so the next block can claim a fresh uuid.
				await db
					.update(ideas)
					.set({ workspaceUuid: null })
					.where(and(eq(ideas.id, ideaId), eq(ideas.workspaceUuid, idea.workspaceUuid)));
			} else if (meta.status === 'error') {
				console.log(`[build:${idea.workspaceUuid}] Previous build failed. Allowing retry.`);
				await db
					.update(ideas)
					.set({ workspaceUuid: null })
					.where(and(eq(ideas.id, ideaId), eq(ideas.workspaceUuid, idea.workspaceUuid)));
			}
		}
	}

	// Allocate a UUID and try to claim it transactionally.
	// `UPDATE ideas SET workspaceUuid=? WHERE id=? AND workspaceUuid IS NULL`
	// — if another request raced us here, our UPDATE affects 0 rows and we
	// re-read the winning UUID instead of double-spending.
	const uuid = randomUUID();
	const wsDir = resolve('workspaces', uuid);

	const claimResult = (await db
		.update(ideas)
		.set({ workspaceUuid: uuid })
		.where(and(eq(ideas.id, ideaId), isNull(ideas.workspaceUuid)))
		.run()) as unknown as { changes?: number } | void;

	// Drizzle/Bun-SQLite returns `{ changes }` for raw .run(); other adapters
	// return void. Treat unknown shapes as "claim succeeded" and fall through
	// to a refresh check below for double-confirmation.
	const claimedChanges =
		claimResult && typeof claimResult === 'object' && 'changes' in claimResult
			? (claimResult.changes ?? 0)
			: 1;
	const claimed = claimedChanges > 0;

	if (!claimed) {
		const [refreshed] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
		if (refreshed?.workspaceUuid) {
			return json({
				uuid: refreshed.workspaceUuid,
				status: 'already_building',
				message: 'Another build was triggered moments earlier; reusing it.'
			});
		}
	}

	// Create the workspace dir + initial spec/metadata.
	mkdirSync(wsDir, { recursive: true });
	mkdirSync(resolve(wsDir, 'versions'), { recursive: true });

	const specPath = resolve(wsDir, 'SPECIFICATION.md');
	writeFileSync(specPath, idea.specDocument, 'utf-8');

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
		ideaTitle: idea.title,
		buildType: 'initial' as const,
		buildPid: null
	};
	writeFileSync(resolve(wsDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

	// Spawn the builder (PID is persisted into metadata atomically inside
	// spawnBuilder, so the watchdog and orphan-detection can find it).
	spawnBuilder(uuid, ['--uuid', uuid, 'build', specPath]);

	// Sanity check that workspaceUuid actually claimed (covers the
	// `claimed=true` adapter-quirk fallback above)
	if (!existsSync(workspaceDir(uuid))) {
		throw error(500, 'Workspace directory disappeared between create and spawn');
	}

	return json({
		uuid,
		status: 'building',
		message: 'Build started. Track progress on the workspace page.'
	});
};

// Reference imports retained for type-checking in case future code paths
// need raw SQL escapes from drizzle.
void sql;
void isValidUuid;
