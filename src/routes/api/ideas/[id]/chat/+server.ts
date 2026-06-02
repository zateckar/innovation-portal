import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ideasService } from '$lib/server/services/ideas';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/ideas/[id]/chat — fetch all messages
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const messages = await ideasService.getChatMessages(params.id);
	return json(messages);
};

// POST /api/ideas/[id]/chat — send a user message, get AI reply
const MAX_CHAT_MESSAGE_LENGTH = 8000;

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const body = await request.json() as { content?: string };
	if (!body.content?.trim()) throw error(400, 'Message content is required');
	if (body.content.length > MAX_CHAT_MESSAGE_LENGTH) {
		throw error(400, `Message is too long (max ${MAX_CHAT_MESSAGE_LENGTH} characters)`);
	}

	// Ensure idea is in development stage
	const [idea] = await db
		.select({ specStatus: ideas.specStatus })
		.from(ideas)
		.where(eq(ideas.id, params.id))
		.limit(1);

	if (!idea) throw error(404, 'Idea not found');
	if (idea.specStatus === 'not_started') {
		throw error(409, 'This idea has not entered the development stage yet');
	}

	const result = await ideasService.sendChatMessage(
		params.id,
		locals.user.id,
		body.content.trim()
	);
	return json(result);
};
