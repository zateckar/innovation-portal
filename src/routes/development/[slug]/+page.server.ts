import { ideasService } from '$lib/server/services/ideas';
import { redirect, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

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

	return {
		idea: { ...idea, chatMessages },
		voteThreshold: settingsRow?.ideaVoteThreshold ?? 5,
		jiraWebHostname: settingsRow?.jiraWebHostname ?? null
	};
};
