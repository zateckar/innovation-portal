import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	spawnBuilder,
	isValidUuid,
	peekMetadata,
	isPidAlive
} from '$lib/server/services/buildLauncher';

const WORKSPACES_ROOT = resolve('workspaces');

/**
 * POST /api/apps/{uuid}/rebuild
 *
 * Triggers a rebuild for an existing workspace.
 *
 * Auth: requires an authenticated user. Ownership: the request user must
 * be an admin OR the proposer of the linked idea.
 *
 * Robustness:
 *   - UUID format strictly validated (was previously, kept).
 *   - Refuses to start a second rebuild while one is in flight.
 *   - Argv-based spawn (NEVER `shell:true` + interpolated strings).
 *   - PID persisted into metadata for orphan detection.
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const { uuid } = params;
	if (!isValidUuid(uuid)) {
		throw error(400, 'Invalid UUID');
	}

	const wsDir = resolve(WORKSPACES_ROOT, uuid);
	if (!existsSync(wsDir)) {
		throw error(404, 'Workspace not found');
	}

	const specPath = resolve(wsDir, 'SPECIFICATION.md');
	if (!existsSync(specPath)) {
		throw error(400, 'No specification found');
	}

	// Ownership: admins always allowed; non-admins must be the proposer
	// of the idea linked to this workspace.
	if (locals.user.role !== 'admin') {
		const [linked] = await db
			.select({ proposedBy: ideas.proposedBy })
			.from(ideas)
			.where(eq(ideas.workspaceUuid, uuid))
			.limit(1);
		if (!linked || linked.proposedBy !== locals.user.id) {
			throw error(403, 'Not authorized to rebuild this application');
		}
	}

	// Refuse if a build is already running.
	const meta = peekMetadata(uuid);
	if (meta) {
		const isStillBuilding =
			meta.status === 'building' ||
			meta.status === 'planning' ||
			meta.status === 'reviewing' ||
			meta.status === 'testing' ||
			meta.status === 'deploying';
		const pidAlive =
			typeof meta.buildPid === 'number' && meta.buildPid > 0 ? isPidAlive(meta.buildPid) : false;
		if (isStillBuilding && pidAlive) {
			throw error(409, 'A build is already in progress for this workspace');
		}
	}

	// Argv-based spawn — no shell, no string interpolation, no injection risk.
	spawnBuilder(uuid, ['rebuild', uuid, specPath]);

	return json({
		status: 'rebuilding',
		message: `Rebuild triggered for workspace ${uuid}`
	});
};
