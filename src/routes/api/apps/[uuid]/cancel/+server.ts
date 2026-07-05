import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { existsSync } from 'fs';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { isValidUuid, workspaceDir, peekMetadata } from '$lib/server/services/buildLauncher';
import { cancelRun, isTerminalStatus } from '$lib/server/services/maminaPipeline';
import { updateMetadataAtomic, appendBuildLogEntry } from '../../../../../../scripts/metadata-store';

/**
 * POST /api/apps/{uuid}/cancel
 *
 * Request cancellation of an in-progress EXTERNAL (Mamina) build run and mark
 * the workspace as terminal. Only applies to workspaces created by the external
 * pipeline; internal builds use /reset instead.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
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
			throw error(403, 'Not authorized to cancel this build');
		}
	}

	const meta = peekMetadata(uuid) as { pipeline?: string; maminaRunId?: string; status?: string } | null;
	if (!meta || meta.pipeline !== 'external') {
		throw error(400, 'Not an external build');
	}
	if (isTerminalStatus(meta.status)) {
		return json({ status: 'noop', message: 'Build is already finished.' });
	}

	// Best-effort remote cancel — even if it fails, mark local state cancelled so
	// the UI is not stuck; the watchdog reconciler will reconcile the true status.
	try {
		if (meta.maminaRunId) await cancelRun(meta.maminaRunId);
	} catch (err) {
		console.warn(`[cancel:${uuid}] remote cancel failed:`, err instanceof Error ? err.message : err);
	}

	await appendBuildLogEntry(uuid, 'Run', 'Cancellation requested by user', 'error');
	await updateMetadataAtomic(uuid, (m) => {
		m.status = 'error';
		m.maminaStatus = 'cancelled';
		m.error = 'Run cancelled by user.';
		return m;
	});

	return json({ status: 'cancelled', message: 'Cancellation requested.' });
};
