import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, comments, innovations, users } from '$lib/server/db';
import { eq, desc, and, isNull, isNotNull, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Get comments for an innovation
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
	const innovationId = params.id;
	
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
		.where(
			and(
				eq(comments.innovationId, innovationId),
				isNull(comments.parentId)
			)
		)
		.orderBy(desc(comments.createdAt));
	
	// Get all replies
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
		.where(
			and(
				eq(comments.innovationId, innovationId),
				isNotNull(comments.parentId)
			)
		)
		.orderBy(comments.createdAt);
	
	// Build threaded structure
	const commentsWithReplies = topLevelComments.map(comment => ({
		...comment,
		replies: replies.filter(r => r.parentId === comment.id)
	}));
	
	return json({ comments: commentsWithReplies });
	} catch {
		return json({ error: 'Failed to load comments' }, { status: 500 });
	}
};

// Add a new comment
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	
	try {
	const innovationId = params.id;
	
	// Verify innovation exists
	const [innovation] = await db
		.select({ id: innovations.id })
		.from(innovations)
		.where(eq(innovations.id, innovationId));
	
	if (!innovation) {
		return json({ error: 'Innovation not found' }, { status: 404 });
	}
	
	const body = await request.json();
	const { content, parentId } = body;
	
	if (!content || typeof content !== 'string' || content.trim().length === 0) {
		return json({ error: 'Comment content is required' }, { status: 400 });
	}
	
	if (content.length > 2000) {
		return json({ error: 'Comment is too long (max 2000 characters)' }, { status: 400 });
	}
	
	// If replying, verify parent comment exists and belongs to the same innovation
	if (parentId) {
		const [parent] = await db
			.select({ id: comments.id })
			.from(comments)
			.where(and(eq(comments.id, parentId), eq(comments.innovationId, innovationId)));
		
		if (!parent) {
			return json({ error: 'Parent comment not found' }, { status: 404 });
		}
	}
	
	const commentId = nanoid();
	
	await db.insert(comments).values({
		id: commentId,
		innovationId,
		userId: locals.user.id,
		parentId: parentId || null,
		content: content.trim()
	});
	
	// Return the created comment with user info
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
