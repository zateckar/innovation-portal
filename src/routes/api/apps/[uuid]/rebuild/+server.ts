import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';

const WORKSPACES_ROOT = resolve('workspaces');

export const POST: RequestHandler = async ({ params }) => {
	const { uuid } = params;

	if (!uuid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) {
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

	// Trigger rebuild in background (fire-and-forget)
	const builderScript = resolve('scripts', 'builder.ts');
	const child = exec(`npx tsx "${builderScript}" rebuild "${uuid}" "${specPath}"`, {
		cwd: resolve('.')
	});

	child.stdout?.on('data', (data: string) => console.log(`[rebuild:${uuid}] ${data}`));
	child.stderr?.on('data', (data: string) => console.error(`[rebuild:${uuid}] ${data}`));

	return json({
		status: 'rebuilding',
		message: `Rebuild triggered for workspace ${uuid}`
	});
};
