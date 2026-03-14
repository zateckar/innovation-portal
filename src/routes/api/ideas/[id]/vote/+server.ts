import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { ideaVotes, ideas } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { ideasService } from '$lib/server/services/ideas';

export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	
	const ideaId = params.id;
	
	// Check if idea exists and is published
	const [idea] = await db
		.select()
		.from(ideas)
		.where(and(eq(ideas.id, ideaId), eq(ideas.status, 'published')));
	
	if (!idea) {
		throw error(404, 'Idea not found');
	}
	
	// Check if already voted
	const [existingVote] = await db
		.select()
		.from(ideaVotes)
		.where(
			and(
				eq(ideaVotes.userId, locals.user.id),
				eq(ideaVotes.ideaId, ideaId)
			)
		);
	
	if (existingVote) {
		throw error(400, 'Already voted');
	}
	
	// Create vote
	await db.insert(ideaVotes).values({
		id: nanoid(),
		userId: locals.user.id,
		ideaId
	});

	// Fire-and-forget: check if this vote pushes the idea over the development threshold
	ideasService.checkAndTriggerDevelopment(ideaId)
		.catch((err) => console.error('[Vote API] checkAndTriggerDevelopment failed:', err));
	
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	
	const ideaId = params.id;
	
	// Check if vote exists
	const [existingVote] = await db
		.select()
		.from(ideaVotes)
		.where(
			and(
				eq(ideaVotes.userId, locals.user.id),
				eq(ideaVotes.ideaId, ideaId)
			)
		);
	
	if (!existingVote) {
		throw error(404, 'Vote not found');
	}
	
	// Delete vote
	await db
		.delete(ideaVotes)
		.where(
			and(
				eq(ideaVotes.userId, locals.user.id),
				eq(ideaVotes.ideaId, ideaId)
			)
		);
	
	return json({ success: true });
};
