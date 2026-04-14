import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve, join } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';

const WORKSPACES_ROOT = resolve('workspaces');

function getLatestVersion(uuid: string): number {
	const versionsDir = resolve(WORKSPACES_ROOT, uuid, 'versions');
	if (!existsSync(versionsDir)) {
		throw error(404, 'No versions found');
	}

	const entries = readdirSync(versionsDir);
	const versionNumbers = entries
		.filter((entry) => /^v\d+$/.test(entry))
		.map((entry) => parseInt(entry.slice(1), 10));

	if (versionNumbers.length === 0) {
		throw error(404, 'No versions found');
	}

	return Math.max(...versionNumbers);
}

export const GET: RequestHandler = async ({ params }) => {
	const { uuid } = params;

	if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
		throw error(400, 'Invalid UUID');
	}

	const wsDir = resolve(WORKSPACES_ROOT, uuid);
	if (!existsSync(wsDir)) {
		throw error(404, 'Workspace not found');
	}

	const latestVersion = getLatestVersion(uuid);
	const clarificationsPath = join(wsDir, 'versions', `v${latestVersion}`, 'CLARIFICATIONS.md');

	if (!existsSync(clarificationsPath)) {
		throw error(404, 'No clarifications found');
	}

	const content = readFileSync(clarificationsPath, 'utf-8');

	return json({ content, uuid, version: latestVersion });
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { uuid } = params;

	if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
		throw error(400, 'Invalid UUID');
	}

	const wsDir = resolve(WORKSPACES_ROOT, uuid);
	if (!existsSync(wsDir)) {
		throw error(404, 'Workspace not found');
	}

	const body = await request.json();
	const { corrections } = body;

	if (!corrections || typeof corrections !== 'string') {
		throw error(400, 'Missing or invalid corrections');
	}

	const latestVersion = getLatestVersion(uuid);
	const clarificationsPath = join(wsDir, 'versions', `v${latestVersion}`, 'CLARIFICATIONS.md');

	if (!existsSync(clarificationsPath)) {
		throw error(404, 'No clarifications found');
	}

	const existing = readFileSync(clarificationsPath, 'utf-8');
	const updated = `${existing}\n\n## User Corrections\n${corrections}\n`;
	writeFileSync(clarificationsPath, updated, 'utf-8');

	return json({ success: true });
};
