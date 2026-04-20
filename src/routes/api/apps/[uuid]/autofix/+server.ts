import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	extractRuntimeErrors,
	formatErrorsForAutofix,
	readRuntimeLogs
} from '$lib/server/services/workspaceRuntimeLogs';
import {
	stopWorkspaceProcess,
	resetWorkspaceCrashCount
} from '$lib/server/services/workspaceProcessManager';
import {
	spawnBuilder,
	isValidUuid,
	isValidVersion,
	peekMetadata,
	isPidAlive
} from '$lib/server/services/buildLauncher';
import {
	updateMetadataAtomic,
	appendBuildLogEntry
} from '../../../../../../scripts/metadata-store';

const WORKSPACES_ROOT = resolve('workspaces');
const MAX_AUTOFIX_ATTEMPTS_PER_VERSION = 3;

function getLatestVersion(uuid: string): number | null {
	const versionsDir = resolve(WORKSPACES_ROOT, uuid, 'versions');
	if (!existsSync(versionsDir)) return null;
	const entries = readdirSync(versionsDir);
	const versions = entries
		.filter((e) => /^v\d+$/.test(e))
		.map((e) => parseInt(e.slice(1), 10))
		.filter((n) => Number.isInteger(n) && n > 0)
		.sort((a, b) => b - a);
	return versions.length > 0 ? versions[0] : null;
}

/**
 * POST /api/apps/[uuid]/autofix
 *
 * Triggers an AI-powered auto-fix for runtime errors.
 *
 * Robustness:
 *   - Auth + ownership (admin OR proposer of the linked idea).
 *   - Strict UUID + version validation (no path traversal).
 *   - Per-version attempt cap (no infinite spawn loops).
 *   - Refuses to overlap a running build (409 Conflict).
 *   - Writes the augmented spec to a TEMPORARY file so a portal crash
 *     mid-rebuild can never leave SPECIFICATION.md permanently mutated.
 *   - Argv-based spawn (NEVER `shell: true`).
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
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

	// Ownership check
	if (locals.user.role !== 'admin') {
		const [linked] = await db
			.select({ proposedBy: ideas.proposedBy })
			.from(ideas)
			.where(eq(ideas.workspaceUuid, uuid))
			.limit(1);
		if (!linked || linked.proposedBy !== locals.user.id) {
			throw error(403, 'Not authorized to autofix this application');
		}
	}

	const body = (await request.json().catch(() => ({}))) as {
		version?: unknown;
		dryRun?: boolean;
	};

	let version: number;
	if (body.version === undefined || body.version === null) {
		const latest = getLatestVersion(uuid);
		if (latest === null) throw error(404, 'No versions found');
		version = latest;
	} else if (isValidVersion(body.version)) {
		version = body.version;
	} else {
		throw error(400, 'Invalid version: must be a positive integer');
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

		// Per-version attempt cap.
		const attempts = typeof meta.autofixAttempts === 'number' ? meta.autofixAttempts : 0;
		if (attempts >= MAX_AUTOFIX_ATTEMPTS_PER_VERSION) {
			throw error(
				429,
				`Auto-fix attempt cap reached (${MAX_AUTOFIX_ATTEMPTS_PER_VERSION}). Make a manual change to the spec and rebuild instead.`
			);
		}
	}

	const errors = extractRuntimeErrors(uuid, version, { limit: 30 });
	if (errors.length === 0) {
		return json({
			status: 'no_errors',
			message: 'No runtime errors detected. Auto-fix is not needed.'
		});
	}

	const formattedErrors = formatErrorsForAutofix(errors);
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

	const originalSpecPath = resolve(wsDir, 'SPECIFICATION.md');
	if (!existsSync(originalSpecPath)) {
		throw error(400, 'No specification found');
	}
	const originalSpec = readFileSync(originalSpecPath, 'utf-8');

	const runtimeFixSection = `

## Runtime Fix Request

> This section was added by the runtime error monitor for THIS REBUILD ONLY.
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

	// Write the augmented spec to a TEMP file. The original spec is left
	// untouched so a portal crash mid-rebuild can't permanently mutate it
	// (which would cause every subsequent normal rebuild to try fixing
	// non-existent runtime errors).
	const tempSpecPath = resolve(wsDir, 'SPECIFICATION.fix.md');
	writeFileSync(tempSpecPath, originalSpec + runtimeFixSection, 'utf-8');

	await updateMetadataAtomic(uuid, (m) => {
		m.status = 'building';
		m.currentPhase = 'Auto-fix: Analyzing runtime errors';
		m.error = undefined;
		m.buildType = 'autofix';
		m.autofixAttempts = (typeof m.autofixAttempts === 'number' ? m.autofixAttempts : 0) + 1;
		return m;
	});
	await appendBuildLogEntry(
		uuid,
		'Auto-fix',
		`Triggered auto-fix for ${errors.length} runtime error(s) (attempt ${(meta?.autofixAttempts ?? 0) + 1}/${MAX_AUTOFIX_ATTEMPTS_PER_VERSION})`,
		'started'
	);

	// Argv-based spawn against the temp spec (NEVER shell:true).
	spawnBuilder(uuid, ['rebuild', uuid, tempSpecPath]);

	return json({
		status: 'autofix_triggered',
		version,
		errorCount: errors.length,
		message: `Auto-fix triggered for ${errors.length} runtime error(s). A rebuild is in progress.`
	});
};
