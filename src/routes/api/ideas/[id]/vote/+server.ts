import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { ideaVotes, ideas } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
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
	
	// Create vote — catch UNIQUE constraint violation from concurrent requests
	try {
		await db.insert(ideaVotes).values({
			id: crypto.randomUUID(),
			userId: locals.user.id,
			ideaId
		});
	} catch {
		// Concurrent request already inserted the vote (UNIQUE constraint)
		return json({ success: true, alreadyVoted: true, developmentTriggered: false });
	}

	// Await the threshold check so the response can tell the client whether
	// this vote just pushed the idea into the development stage. The client
	// uses this signal to invalidate the page and reveal the "Join Chat"
	// banner without requiring a manual reload.
	let developmentTriggered = false;
	try {
		developmentTriggered = await ideasService.checkAndTriggerDevelopment(ideaId);
	} catch (err) {
		console.error('[Vote API] checkAndTriggerDevelopment failed:', err);
	}

	return json({ success: true, developmentTriggered });
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
