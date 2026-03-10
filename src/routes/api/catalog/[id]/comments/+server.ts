import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { comments, catalogItems, users } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Get comments for a catalog item
export const GET: RequestHandler = async ({ params }) => {
	const catalogItemId = params.id;

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
		.where(and(eq(comments.catalogItemId, catalogItemId), isNull(comments.parentId)))
		.orderBy(comments.createdAt);

	// Get all replies for this catalog item
	const allReplies = await db
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
		.where(eq(comments.catalogItemId, catalogItemId))
		.orderBy(comments.createdAt);

	const replies = allReplies.filter(r => r.parentId !== null);

	const commentsWithReplies = topLevelComments.map(comment => ({
		...comment,
		replies: replies.filter(r => r.parentId === comment.id)
	}));

	return json({ comments: commentsWithReplies });
};

// Add a new comment to a catalog item
export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const catalogItemId = params.id;

	// Verify catalog item exists
	const [item] = await db
		.select({ id: catalogItems.id })
		.from(catalogItems)
		.where(eq(catalogItems.id, catalogItemId));

	if (!item) {
		return json({ error: 'Catalog item not found' }, { status: 404 });
	}

	const body = await request.json();
	const { content, parentId } = body;

	if (!content || typeof content !== 'string' || content.trim().length === 0) {
		return json({ error: 'Comment content is required' }, { status: 400 });
	}

	if (content.length > 2000) {
		return json({ error: 'Comment is too long (max 2000 characters)' }, { status: 400 });
	}

	// If replying, verify parent comment exists and belongs to the same catalog item
	if (parentId) {
		const [parent] = await db
			.select({ id: comments.id })
			.from(comments)
			.where(and(eq(comments.id, parentId), eq(comments.catalogItemId, catalogItemId)));

		if (!parent) {
			return json({ error: 'Parent comment not found' }, { status: 404 });
		}
	}

	const commentId = nanoid();

	await db.insert(comments).values({
		id: commentId,
		catalogItemId,
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
};
