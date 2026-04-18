import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve, join } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { exec } from 'child_process';
import { extractRuntimeErrors, formatErrorsForAutofix, readRuntimeLogs } from '$lib/server/services/workspaceRuntimeLogs';
import { stopWorkspaceProcess, resetWorkspaceCrashCount } from '$lib/server/services/workspaceProcessManager';

const WORKSPACES_ROOT = resolve('workspaces');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function getLatestVersion(uuid: string): number | null {
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
 * POST /api/apps/[uuid]/autofix
 *
 * Trigger an AI-powered auto-fix for runtime errors.
 *
 * This works by:
 * 1. Reading the runtime error log
 * 2. Appending runtime errors to the SPECIFICATION.md as a "Runtime Fix Request" section
 * 3. Triggering a rebuild with the error context
 * 4. The builder will read the errors and attempt targeted fixes
 *
 * Body (optional):
 *   { version?: number, dryRun?: boolean }
 *
 * dryRun: true returns the error analysis without triggering a rebuild
 */
export const POST: RequestHandler = async ({ params, request }) => {
	const { uuid } = params;

	if (!uuid || !UUID_RE.test(uuid)) {
		throw error(400, 'Invalid UUID');
	}

	const wsDir = resolve(WORKSPACES_ROOT, uuid);
	if (!existsSync(wsDir)) {
		throw error(404, 'Workspace not found');
	}

	const body = await request.json().catch(() => ({})) as {
		version?: number;
		dryRun?: boolean;
	};

	const version = body.version ?? getLatestVersion(uuid);
	if (!version) {
		throw error(404, 'No versions found');
	}

	// Extract runtime errors
	const errors = extractRuntimeErrors(uuid, version, { limit: 30 });
	if (errors.length === 0) {
		return json({
			status: 'no_errors',
			message: 'No runtime errors detected. Auto-fix is not needed.'
		});
	}

	const formattedErrors = formatErrorsForAutofix(errors);

	// Also get the last 50 log lines for context
	const recentLogs = readRuntimeLogs(uuid, version, { limit: 50 });
	const recentLogText = recentLogs
		.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`)
		.join('\n');

	if (body.dryRun) {
		return json({
			status: 'dry_run',
			version,
			errorCount: errors.length,
			errors,
			formattedErrors,
			recentLogs: recentLogText
		});
	}

	// Stop the running process before rebuild
	stopWorkspaceProcess(uuid, version);
	resetWorkspaceCrashCount(uuid, version);

	// Read existing spec
	const specPath = resolve(wsDir, 'SPECIFICATION.md');
	if (!existsSync(specPath)) {
		throw error(400, 'No specification found');
	}

	const originalSpec = readFileSync(specPath, 'utf-8');

	// Append runtime fix request to the spec
	const runtimeFixSection = `

## Runtime Fix Request

> This section was automatically added by the runtime error monitor.
> The application has encountered the following runtime errors after deployment.
> Please fix these issues while preserving all existing functionality.

### Runtime Errors Detected

${formattedErrors}

### Recent Log Output

\`\`\`
${recentLogText.slice(-3000)}
\`\`\`

### Fix Instructions

1. Analyze the errors above and identify root causes
2. Fix each error while maintaining backward compatibility
3. Ensure all existing features continue to work
4. Add error handling where appropriate to prevent similar crashes
5. Test the fixes: \`bun run build\` must pass
`;

	// Write the augmented spec
	writeFileSync(specPath, originalSpec + runtimeFixSection, 'utf-8');

	// Update metadata to indicate auto-fix is in progress
	const metaPath = resolve(wsDir, 'metadata.json');
	if (existsSync(metaPath)) {
		try {
			const metadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
			metadata.status = 'building';
			metadata.currentPhase = 'Auto-fix: Analyzing runtime errors';
			metadata.error = undefined;
			if (!metadata.buildLog) metadata.buildLog = [];
			metadata.buildLog.push({
				timestamp: new Date().toISOString(),
				phase: 'Auto-fix',
				message: `Triggered auto-fix for ${errors.length} runtime error(s)`,
				status: 'started'
			});
			writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
		} catch {
			// non-critical
		}
	}

	// Trigger rebuild in background (fire-and-forget)
	const builderScript = resolve('scripts', 'builder.ts');
	const child = exec(`bun "${builderScript}" rebuild "${uuid}" "${specPath}"`, {
		cwd: resolve('.')
	});

	child.stdout?.on('data', (data: string) => console.log(`[autofix:${uuid.slice(0, 8)}] ${data}`));
	child.stderr?.on('data', (data: string) => console.error(`[autofix:${uuid.slice(0, 8)}] ${data}`));

	child.on('exit', (code) => {
		// Clean up the runtime fix section from the spec after rebuild
		// (regardless of success/failure) so it doesn't accumulate
		try {
			const currentSpec = readFileSync(specPath, 'utf-8');
			const cleanedSpec = currentSpec.replace(/\n\n## Runtime Fix Request[\s\S]*$/, '');
			writeFileSync(specPath, cleanedSpec, 'utf-8');
		} catch {
			// non-critical
		}

		if (code === 0) {
			console.log(`[autofix:${uuid.slice(0, 8)}] Auto-fix rebuild completed successfully`);
		} else {
			console.error(`[autofix:${uuid.slice(0, 8)}] Auto-fix rebuild failed with code ${code}`);
		}
	});

	return json({
		status: 'autofix_triggered',
		version,
		errorCount: errors.length,
		message: `Auto-fix triggered for ${errors.length} runtime error(s). A rebuild is in progress.`
	});
};
