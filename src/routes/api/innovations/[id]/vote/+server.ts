import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, votes, innovations } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	
	const innovationId = params.id;
	
	// Check if innovation exists and is published
	const [innovation] = await db
		.select()
		.from(innovations)
		.where(and(eq(innovations.id, innovationId), eq(innovations.status, 'published')));
	
	if (!innovation) {
		throw error(404, 'Innovation not found');
	}
	
	// Check if already voted
	const [existingVote] = await db
		.select()
		.from(votes)
		.where(
			and(
				eq(votes.userId, locals.user.id),
				eq(votes.innovationId, innovationId)
			)
		);
	
	if (existingVote) {
		throw error(400, 'Already voted');
	}
	
	// Create vote — catch UNIQUE constraint violation from concurrent requests
	try {
		await db.insert(votes).values({
			id: crypto.randomUUID(),
			userId: locals.user.id,
			innovationId
		});
	} catch {
		// Concurrent request already inserted the vote (UNIQUE constraint)
		return json({ success: true, alreadyVoted: true });
	}
	
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}
	
	const innovationId = params.id;
	
	// Check if vote exists
	const [existingVote] = await db
		.select()
		.from(votes)
		.where(
			and(
				eq(votes.userId, locals.user.id),
				eq(votes.innovationId, innovationId)
			)
		);
	
	if (!existingVote) {
		throw error(404, 'Vote not found');
	}
	
	// Delete vote
	await db
		.delete(votes)
		.where(
			and(
				eq(votes.userId, locals.user.id),
				eq(votes.innovationId, innovationId)
			)
		);
	
	return json({ success: true });
};
