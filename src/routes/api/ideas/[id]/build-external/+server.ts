import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { resolve } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { peekMetadata, workspaceDir } from '$lib/server/services/buildLauncher';
import {
	createRun,
	isConfigured,
	isTerminalStatus
} from '$lib/server/services/maminaPipeline';

/**
 * POST /api/ideas/{id}/build-external
 *
 * Triggers the EXTERNAL (Mamina) autonomous build pipeline for an idea's
 * specification. This mirrors the internal `/build` endpoint's atomic
 * workspace-claim logic, but instead of spawning a local builder subprocess it
 * creates a remote Mamina run and records its id in the workspace metadata
 * (tagged `pipeline: 'external'`). Progress is pulled in later by the dev-page
 * loader and the build watchdog via `syncRunToWorkspace`.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	if (!isConfigured()) {
		throw error(503, 'External build pipeline is not configured');
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
			// An in-progress external run — reuse it rather than starting a duplicate.
			if (!isTerminalStatus(meta.status)) {
				return json({
					uuid: idea.workspaceUuid,
					status: 'already_building',
					message: 'A build is already in progress for this idea.'
				});
			}
			// Terminal (deployed/error) → clear the link so we can claim a fresh run.
			await db
				.update(ideas)
				.set({ workspaceUuid: null })
				.where(and(eq(ideas.id, ideaId), eq(ideas.workspaceUuid, idea.workspaceUuid)));
		} else {
			// Metadata gone (e.g. workspace volume wiped) — clear the stale link.
			await db
				.update(ideas)
				.set({ workspaceUuid: null })
				.where(and(eq(ideas.id, ideaId), eq(ideas.workspaceUuid, idea.workspaceUuid)));
		}
	}

	// Allocate a UUID and atomically claim it (see /build for the race rationale).
	const uuid = randomUUID();
	const wsDir = resolve('workspaces', uuid);

	const claimed = await db
		.update(ideas)
		.set({ workspaceUuid: uuid })
		.where(and(eq(ideas.id, ideaId), isNull(ideas.workspaceUuid)))
		.returning({ id: ideas.id });

	if (claimed.length === 0) {
		const [refreshed] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
		if (refreshed?.workspaceUuid) {
			return json({
				uuid: refreshed.workspaceUuid,
				status: 'already_building',
				message: 'Another build was triggered moments earlier; reusing it.'
			});
		}
	}

	// Create the workspace dir + spec so the metadata store (and any future
	// rebuild) have something to work with.
	mkdirSync(wsDir, { recursive: true });
	mkdirSync(resolve(wsDir, 'versions'), { recursive: true });
	writeFileSync(resolve(wsDir, 'SPECIFICATION.md'), idea.specDocument, 'utf-8');

	// Kick off the remote run. If this throws, release the claim so the user can
	// retry instead of being stuck with an empty workspace.
	let run;
	try {
		run = await createRun(idea.specDocument, idea.title, uuid);
	} catch (err) {
		await db
			.update(ideas)
			.set({ workspaceUuid: null })
			.where(and(eq(ideas.id, ideaId), eq(ideas.workspaceUuid, uuid)));
		console.error(`[build-external:${uuid}] createRun failed:`, err);
		throw error(502, 'Failed to start external build run');
	}

	const now = new Date().toISOString();
	const metadata = {
		uuid,
		createdAt: now,
		lastUpdated: now,
		pipeline: 'external' as const,
		maminaRunId: run.id,
		maminaStatus: run.status,
		status: 'building',
		lastEventId: 0,
		externalCostUsd: 0,
		deployUrl: null,
		prUrl: null,
		buildLog: [
			{ timestamp: now, phase: 'Run', message: `External run created (${run.id})`, status: 'info' }
		],
		currentVersion: 0,
		versions: [],
		ideaId: idea.id,
		ideaSlug: idea.slug,
		ideaTitle: idea.title
	};
	writeFileSync(resolve(wsDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

	if (!existsSync(workspaceDir(uuid))) {
		throw error(500, 'Workspace directory disappeared between create and run');
	}

	return json({
		uuid,
		status: 'building',
		message: 'External build started. Track progress on the workspace page.'
	});
};
