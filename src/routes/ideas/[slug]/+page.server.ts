import type { PageServerLoad } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;

	try {
	const idea = await ideasService.getIdeaBySlug(params.slug, userId);
	
	if (!idea) {
		throw redirect(302, `${base}/ideas`);
	}

	const [settingsRow] = await db
		.select({ ideaVoteThreshold: settings.ideaVoteThreshold, jiraWebHostname: settings.jiraWebHostname })
		.from(settings)
		.where(eq(settings.id, 'default'))
		.limit(1);

	// Auto-recover: if idea is in development but the AI opening message was never
	// stored (e.g., LLM was unavailable when the idea first crossed the vote threshold),
	// silently regenerate it so the conversation can start properly.
	let chatMessages = idea.chatMessages;
	if (idea.specStatus === 'in_progress' && !chatMessages.some((m) => m.role === 'ai')) {
		try {
			const recovered = await ideasService.ensureOpeningMessage(idea.id);
			if (recovered) {
				chatMessages = await ideasService.getChatMessages(idea.id);
			}
		} catch {
			// Non-critical — page will still load without the opening message
		}
	}
	
	return {
		idea: { ...idea, chatMessages },
		voteThreshold: settingsRow?.ideaVoteThreshold ?? 5,
		jiraWebHostname: settingsRow?.jiraWebHostname ?? null
	};
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		if (e && typeof e === 'object' && 'location' in e) throw e; // redirect
		throw redirect(302, `${base}/ideas`);
	}
};
