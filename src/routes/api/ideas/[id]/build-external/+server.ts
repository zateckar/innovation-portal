import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { peekMetadata } from '$lib/server/services/buildLauncher';
import { isConfigured, isTerminalStatus } from '$lib/server/services/maminaPipeline';
import { startFreshExternalRun } from '$lib/server/services/externalBuildLauncher';

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

	try {
		const result = await startFreshExternalRun({
			id: idea.id,
			slug: idea.slug,
			title: idea.title,
			specDocument: idea.specDocument
		});
		return json(result);
	} catch (err) {
		console.error(`[build-external:${ideaId}] startFreshExternalRun failed:`, err);
		throw error(502, 'Failed to start external build run');
	}
};
