import { ideasService } from '$lib/server/services/ideas';
import { redirect, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { resolve, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { getRuntimeLogSummary, type RuntimeLogSummary } from '$lib/server/services/workspaceRuntimeLogs';
import { checkWorkspaceHealth, getWorkspaceCrashCount } from '$lib/server/services/workspaceProcessManager';

const WORKSPACES_ROOT = resolve('workspaces');

export const load = async ({ params, locals }: { params: { slug: string }; locals: App.Locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;
	const idea = await ideasService.getIdeaBySlug(params.slug, userId);

	if (!idea) {
		throw error(404, 'Idea not found');
	}

	// Only ideas in development are accessible via this route
	if (idea.specStatus === 'not_started') {
		throw redirect(302, `/ideas/${params.slug}`);
	}

	const [settingsRow] = await db
		.select({ ideaVoteThreshold: settings.ideaVoteThreshold, jiraWebHostname: settings.jiraWebHostname })
		.from(settings)
		.where(eq(settings.id, 'default'))
		.limit(1);

	// Auto-recover: if idea is in development but the AI opening message was never
	// stored, silently regenerate it so the conversation can start properly.
	let chatMessages = idea.chatMessages;
	if (idea.specStatus === 'in_progress' && !chatMessages.some((m) => m.role === 'ai')) {
		try {
			const recovered = await ideasService.ensureOpeningMessage(idea.id);
			if (recovered) {
				chatMessages = await ideasService.getChatMessages(idea.id);
			}
		} catch {
			// Non-critical
		}
	}

	// Load workspace build state if a workspace is linked
	let workspaceMetadata: Record<string, unknown> | null = null;
	let stateContent = '';

	if (idea.workspaceUuid) {
		const wsDir = resolve(WORKSPACES_ROOT, idea.workspaceUuid);
		const metaPath = join(wsDir, 'metadata.json');

		if (existsSync(metaPath)) {
			try {
				workspaceMetadata = JSON.parse(readFileSync(metaPath, 'utf-8'));
			} catch {
				// Non-critical
			}
		}

		// Detect stale/orphaned builds via heartbeat.
		// Uses phase-aware thresholds: building/testing phases legitimately take
		// longer than planning/deploying phases. The heartbeat file is updated by
		// the opencode-agent on every AI interaction, so its absence or staleness
		// is a strong signal the process has crashed.
		if (workspaceMetadata) {
			const meta = workspaceMetadata as Record<string, unknown>;
			const activeStatuses = ['creating', 'planning', 'reviewing', 'building', 'testing', 'deploying'];
			if (activeStatuses.includes(meta.status as string)) {
				const heartbeatPath = join(wsDir, 'heartbeat.json');
				let lastActivity = meta.lastUpdated as string | undefined;

				if (existsSync(heartbeatPath)) {
					try {
						const hb = JSON.parse(readFileSync(heartbeatPath, 'utf-8'));
						lastActivity = hb.timestamp;
					} catch {
						// Ignore malformed heartbeat
					}
				}

				if (lastActivity) {
					// Phase-aware stale thresholds (minutes)
					const phaseThresholds: Record<string, number> = {
						creating: 15,
						planning: 60,    // AI planning can take a while
						reviewing: 45,
						building: 120,   // layered build: 5 layers × ~20 min each
						testing: 90,     // fix-loop can run 5 iterations × ~10 min
						deploying: 30
					};
					const thresholdMinutes = phaseThresholds[meta.status as string] ?? 90;
					const staleThresholdMs = thresholdMinutes * 60 * 1000;
					const elapsed = Date.now() - new Date(lastActivity).getTime();
					if (elapsed > staleThresholdMs) {
						try {
							const staleMeta = { ...meta, status: 'error', error: `Build appears stalled during ${meta.status} (no activity for ${Math.round(elapsed / 60000)} minutes). Click "Retry Build" to try again.` };
							writeFileSync(metaPath, JSON.stringify(staleMeta, null, 2), 'utf-8');
							workspaceMetadata = staleMeta;
						} catch {
							// Non-critical
						}
					}
				}
			}
		}

		// Read STATE.md from current version directory
		const currentVersion = (workspaceMetadata as { currentVersion?: number })?.currentVersion;
		if (currentVersion && currentVersion > 0) {
			const statePath = join(wsDir, 'versions', `v${currentVersion}`, 'STATE.md');
			if (existsSync(statePath)) {
				stateContent = readFileSync(statePath, 'utf-8');
			}
		}
	}

	// Load runtime health data for deployed versions
	let runtimeStatus: Record<string, unknown> | null = null;

	if (idea.workspaceUuid && workspaceMetadata) {
		const meta = workspaceMetadata as { currentVersion?: number; status?: string };
		const currentVersion = meta.currentVersion;

		if (currentVersion && currentVersion > 0 && meta.status === 'deployed') {
			try {
				const logSummary = getRuntimeLogSummary(idea.workspaceUuid, currentVersion);
				const health = await checkWorkspaceHealth(idea.workspaceUuid, currentVersion);
				const crashes = getWorkspaceCrashCount(idea.workspaceUuid, currentVersion);

				runtimeStatus = {
					logSummary,
					health,
					crashCount: crashes
				};
			} catch {
				// Non-critical
			}
		}
	}

	return {
		idea: { ...idea, chatMessages },
		voteThreshold: settingsRow?.ideaVoteThreshold ?? 5,
		jiraWebHostname: settingsRow?.jiraWebHostname ?? null,
		workspaceMetadata,
		stateContent,
		runtimeStatus
	};
};
