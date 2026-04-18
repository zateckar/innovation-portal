import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
import {
	checkWorkspaceHealth,
	getWorkspaceCrashCount,
	getWorkspaceProcessStatus
} from '$lib/server/services/workspaceProcessManager';
import { extractRuntimeErrors } from '$lib/server/services/workspaceRuntimeLogs';

const WORKSPACES_ROOT = resolve('workspaces');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * GET /api/apps/[uuid]/status
 *
 * Returns runtime health status for a workspace, including:
 * - Build status from metadata.json
 * - Process health (running, ready, healthy)
 * - Crash count
 * - Recent runtime errors
 * - Per-version status
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

	// Read metadata
	let metadata: Record<string, unknown> = {};
	const metaPath = resolve(wsDir, 'metadata.json');
	if (existsSync(metaPath)) {
		try {
			metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
		} catch {
			// ignore
		}
	}

	// Get version info
	const versionsDir = resolve(wsDir, 'versions');
	const versions: Array<{
		version: number;
		hasDeployment: boolean;
		health: Awaited<ReturnType<typeof checkWorkspaceHealth>>;
		recentErrors: number;
	}> = [];

	if (existsSync(versionsDir)) {
		const versionDirs = readdirSync(versionsDir)
			.filter((d) => /^v\d+$/.test(d))
			.map((d) => parseInt(d.slice(1), 10))
			.sort((a, b) => a - b);

		// Only check specific version if requested, otherwise check all
		const versionParam = url.searchParams.get('version');
		const versionsToCheck = versionParam
			? [parseInt(versionParam, 10)]
			: versionDirs;

		for (const v of versionsToCheck) {
			const deployDir = resolve(versionsDir, `v${v}`, 'deployment');
			const hasDeployment = existsSync(resolve(deployDir, 'index.js'));
			const health = await checkWorkspaceHealth(uuid, v);
			const errors = extractRuntimeErrors(uuid, v, { limit: 5 });

			versions.push({
				version: v,
				hasDeployment,
				health,
				recentErrors: errors.length
			});
		}
	}

	// Overall status
	const hasErrors = versions.some((v) => v.recentErrors > 0);
	const hasCrashes = versions.some((v) => v.health.crashCount > 0);
	const allHealthy = versions
		.filter((v) => v.hasDeployment)
		.every((v) => !v.health.running || v.health.healthy);

	return json({
		uuid,
		buildStatus: metadata.status || 'unknown',
		buildError: metadata.error || null,
		overallHealth: hasCrashes ? 'critical' : hasErrors ? 'warning' : allHealthy ? 'healthy' : 'unknown',
		versions
	});
};
