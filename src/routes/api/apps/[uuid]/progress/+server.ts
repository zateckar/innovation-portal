import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { existsSync } from 'fs';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { isValidUuid, workspaceDir } from '$lib/server/services/buildLauncher';
import { syncRunToWorkspace, isTerminalStatus } from '$lib/server/services/maminaPipeline';
import { readMetadataSafeExt } from '../../../../../../scripts/metadata-store';

/**
 * GET /api/apps/{uuid}/progress?since={n}
 *
 * Lightweight incremental progress feed for EXTERNAL (Mamina) builds. The
 * development page polls this every 5s instead of re-running the SvelteKit
 * `load` (whose `__data.json` re-ships the whole, ever-growing `buildLog`).
 *
 * `since` = the number of buildLog rows the client already has. Only rows at
 * index >= `since` are returned, so the payload stays flat regardless of how
 * long the build has been running. Small scalar status fields are always
 * included so the client can update status/cost/deploy without a full reload.
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const { uuid } = params;
	if (!isValidUuid(uuid)) {
		throw error(400, 'Invalid UUID');
	}
	if (!existsSync(workspaceDir(uuid))) {
		throw error(404, 'Workspace not found');
	}

	// Ownership: admins always allowed; non-admins must be the proposer.
	if (locals.user.role !== 'admin') {
		const [linked] = await db
			.select({ proposedBy: ideas.proposedBy })
			.from(ideas)
			.where(eq(ideas.workspaceUuid, uuid))
			.limit(1);
		if (!linked || linked.proposedBy !== locals.user.id) {
			throw error(403, 'Not authorized to view this build');
		}
	}

	let meta = readMetadataSafeExt(uuid);
	if (!meta || meta.pipeline !== 'external') {
		throw error(400, 'Not an external build');
	}

	// Pull fresh remote run state (throttled + coalesced internally), then re-read.
	try {
		await syncRunToWorkspace(uuid);
		meta = readMetadataSafeExt(uuid) ?? meta;
	} catch {
		// Non-critical — return last-known metadata.
	}

	const log = Array.isArray(meta.buildLog) ? meta.buildLog : [];
	const total = log.length;
	const since = Number(url.searchParams.get('since'));
	const from = Number.isInteger(since) && since >= 0 && since <= total ? since : 0;
	const logEntries = log.slice(from);

	const status = meta.status;
	return json({
		status,
		currentPhase: meta.currentPhase ?? null,
		error: meta.error ?? null,
		maminaStatus: meta.maminaStatus ?? null,
		externalCostUsd: meta.externalCostUsd ?? null,
		deployUrl: meta.deployUrl ?? null,
		prUrl: meta.prUrl ?? null,
		logFrom: from,
		logTotal: total,
		logEntries,
		terminal: isTerminalStatus(status)
	});
};
