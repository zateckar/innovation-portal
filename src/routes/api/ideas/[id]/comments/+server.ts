import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments, ideas, users } from '$lib/server/db/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Get comments for an idea
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
	const ideaId = params.id;

	// Get top-level comments with user info
	const topLevelComments = await db
		.select({
			id: comments.id,
			content: comments.content,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt,
			parentId: comments.parentId,
			userId: comments.userId,
			userName: users.name,
			userAvatar: users.avatarUrl
		})
		.from(comments)
		.innerJoin(users, eq(comments.userId, users.id))
		.where(and(eq(comments.ideaId, ideaId), isNull(comments.parentId)))
		.orderBy(comments.createdAt);

	// Get replies only
	const replies = await db
		.select({
			id: comments.id,
			content: comments.content,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt,
			parentId: comments.parentId,
			userId: comments.userId,
			userName: users.name,
			userAvatar: users.avatarUrl
		})
		.from(comments)
		.innerJoin(users, eq(comments.userId, users.id))
		.where(and(eq(comments.ideaId, ideaId), isNotNull(comments.parentId)))
		.orderBy(comments.createdAt);

	const commentsWithReplies = topLevelComments.map(comment => ({
		...comment,
		replies: replies.filter(r => r.parentId === comment.id)
	}));

	return json({ comments: commentsWithReplies });
	} catch {
		return json({ error: 'Failed to load comments' }, { status: 500 });
	}
};

// Add a new comment to an idea
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
	const ideaId = params.id;

	// Verify idea exists
	const [idea] = await db
		.select({ id: ideas.id })
		.from(ideas)
		.where(eq(ideas.id, ideaId));

	if (!idea) {
		return json({ error: 'Idea not found' }, { status: 404 });
	}

	const body = await request.json();
	const { content, parentId } = body;

	if (!content || typeof content !== 'string' || content.trim().length === 0) {
		return json({ error: 'Comment content is required' }, { status: 400 });
	}

	if (content.length > 2000) {
		return json({ error: 'Comment is too long (max 2000 characters)' }, { status: 400 });
	}

	// If replying, verify parent comment exists and belongs to the same idea
	if (parentId) {
		const [parent] = await db
			.select({ id: comments.id })
			.from(comments)
			.where(and(eq(comments.id, parentId), eq(comments.ideaId, ideaId)));

		if (!parent) {
			return json({ error: 'Parent comment not found' }, { status: 404 });
		}
	}

	const commentId = nanoid();

	await db.insert(comments).values({
		id: commentId,
		ideaId,
		userId: locals.user.id,
		parentId: parentId || null,
		content: content.trim()
	});

	const [newComment] = await db
		.select({
			id: comments.id,
			content: comments.content,
			createdAt: comments.createdAt,
			updatedAt: comments.updatedAt,
			parentId: comments.parentId,
			userId: comments.userId,
			userName: users.name,
			userAvatar: users.avatarUrl
		})
		.from(comments)
		.innerJoin(users, eq(comments.userId, users.id))
		.where(eq(comments.id, commentId));

	return json({ comment: newComment }, { status: 201 });
	} catch {
		return json({ error: 'Failed to create comment' }, { status: 500 });
	}
};
