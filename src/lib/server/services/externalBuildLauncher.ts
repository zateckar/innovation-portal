/**
 * External Build Launcher
 *
 * Mints a brand-new external (Mamina) run for an idea: claims a fresh
 * workspace uuid, writes the spec + initial metadata, and kicks off the
 * remote run. Shared by `/api/ideas/{id}/build-external` (first build /
 * retry-after-terminal) and `/api/apps/{uuid}/reset` (force reset-and-rebuild
 * for an external workspace) so both call sites mint runs identically.
 */
import { resolve } from 'path';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { workspaceDir } from './buildLauncher';
import { createRun } from './maminaPipeline';

export interface StartExternalRunResult {
	uuid: string;
	status: 'building' | 'already_building';
	message: string;
}

export interface ExternalRunIdea {
	id: string;
	slug: string;
	title: string;
	specDocument: string;
}

/**
 * Claim a fresh workspace uuid for `idea.id` (only succeeds while its
 * `workspaceUuid` is null — callers are responsible for clearing any stale
 * link first) and create a new external run: workspace dir + spec file,
 * remote Mamina run, initial metadata.json.
 */
export async function startFreshExternalRun(idea: ExternalRunIdea): Promise<StartExternalRunResult> {
	const uuid = randomUUID();
	const wsDir = resolve('workspaces', uuid);

	const claimed = await db
		.update(ideas)
		.set({ workspaceUuid: uuid })
		.where(and(eq(ideas.id, idea.id), isNull(ideas.workspaceUuid)))
		.returning({ id: ideas.id });

	if (claimed.length === 0) {
		const [refreshed] = await db.select().from(ideas).where(eq(ideas.id, idea.id)).limit(1);
		if (refreshed?.workspaceUuid) {
			return {
				uuid: refreshed.workspaceUuid,
				status: 'already_building',
				message: 'Another build was triggered moments earlier; reusing it.'
			};
		}
	}

	// Create the workspace dir + spec so the metadata store (and any future
	// rebuild) have something to work with.
	mkdirSync(wsDir, { recursive: true });
	mkdirSync(resolve(wsDir, 'versions'), { recursive: true });
	writeFileSync(resolve(wsDir, 'SPECIFICATION.md'), idea.specDocument, 'utf-8');

	// Kick off the remote run. If this throws, release the claim so the user
	// can retry instead of being stuck with an empty workspace.
	let run;
	try {
		run = await createRun(idea.specDocument, idea.title, uuid);
	} catch (err) {
		await db
			.update(ideas)
			.set({ workspaceUuid: null })
			.where(and(eq(ideas.id, idea.id), eq(ideas.workspaceUuid, uuid)));
		console.error(`[external-build:${uuid}] createRun failed:`, err);
		throw new Error('Failed to start external build run');
	}

	const now = new Date().toISOString();
	const metadata = {
		uuid,
		createdAt: now,
		lastUpdated: now,
		pipeline: 'external' as const,
		maminaRunId: run.id,
		maminaStatus: run.status,
		status: 'building',
		lastEventId: 0,
		externalCostUsd: 0,
		deployUrl: null,
		prUrl: null,
		buildLog: [
			{ timestamp: now, phase: 'Run', message: `External run created (${run.id})`, status: 'info' }
		],
		currentVersion: 0,
		versions: [],
		ideaId: idea.id,
		ideaSlug: idea.slug,
		ideaTitle: idea.title
	};
	writeFileSync(resolve(wsDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

	if (!existsSync(workspaceDir(uuid))) {
		throw new Error('Workspace directory disappeared between create and run');
	}

	return {
		uuid,
		status: 'building',
		message: 'External build started. Track progress on the workspace page.'
	};
}
