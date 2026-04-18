import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve } from 'path';
import { existsSync, readdirSync } from 'fs';
import {
	readRuntimeLogs,
	extractRuntimeErrors,
	getRuntimeLogSummary
} from '$lib/server/services/workspaceRuntimeLogs';

const WORKSPACES_ROOT = resolve('workspaces');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function getLatestDeployedVersion(uuid: string): number | null {
	const versionsDir = resolve(WORKSPACES_ROOT, uuid, 'versions');
	if (!existsSync(versionsDir)) return null;

	const entries = readdirSync(versionsDir);
	const versions = entries
		.filter((e) => /^v\d+$/.test(e))
		.map((e) => parseInt(e.slice(1), 10))
		.sort((a, b) => b - a);

	return versions.length > 0 ? versions[0] : null;
}

/**
 * GET /api/apps/[uuid]/logs
 *
 * Query runtime logs for a workspace version.
 *
 * Query params:
 *   version - version number (defaults to latest)
 *   limit   - max entries (default 200, max 1000)
 *   level   - 'OUT' | 'ERR' | 'all' (default 'all')
 *   since   - ISO timestamp filter
 *   mode    - 'logs' | 'errors' | 'summary' (default 'summary')
 */
export const GET: RequestHandler = async ({ params, url }) => {
	const { uuid } = params;

	if (!uuid || !UUID_RE.test(uuid)) {
		throw error(400, 'Invalid UUID');
	}

	const wsDir = resolve(WORKSPACES_ROOT, uuid);
	if (!existsSync(wsDir)) {
		throw error(404, 'Workspace not found');
	}

	const versionParam = url.searchParams.get('version');
	const version = versionParam ? parseInt(versionParam, 10) : getLatestDeployedVersion(uuid);

	if (!version || isNaN(version)) {
		throw error(404, 'No versions found');
	}

	const mode = url.searchParams.get('mode') || 'summary';
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1000);
	const level = (url.searchParams.get('level') || 'all') as 'OUT' | 'ERR' | 'all';
	const since = url.searchParams.get('since') || undefined;

	switch (mode) {
		case 'logs': {
			const logs = readRuntimeLogs(uuid, version, { limit, level, since });
			return json({ uuid, version, logs, count: logs.length });
		}

		case 'errors': {
			const errors = extractRuntimeErrors(uuid, version, { since, limit });
			return json({ uuid, version, errors, count: errors.length });
		}

		case 'summary':
		default: {
			const summary = getRuntimeLogSummary(uuid, version);
			return json({ uuid, version, ...summary });
		}
	}
};
