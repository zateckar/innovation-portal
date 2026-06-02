import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, comments, innovations, users } from '$lib/server/db';
import { eq, desc, and, isNull, isNotNull, inArray } from 'drizzle-orm';

// Bounds on the comment GET response. The previous implementation loaded every
// reply for an innovation in a single query — a 10k-comment thread OOM'd the
// SSR. We now cap the response; the client can ask for more replies via
// /api/comments?parent=<id>&offset=… (see api/comments/[id]/+server.ts).
const MAX_TOP_LEVEL_COMMENTS = 50;
const MAX_REPLIES_PER_PARENT = 20;

// Get comments for an innovation
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
	const innovationId = params.id;

	// Get top-level comments with user info (most recent first, capped)
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
		.orderBy(desc(comments.createdAt))
		.limit(MAX_TOP_LEVEL_COMMENTS);

	const topLevelIds = topLevelComments.map((c) => c.id);

	// Only fetch replies for the top-level comments we are actually returning.
	// Bounded in app code per parent so a single mega-thread can't blow up the
	// payload. The full reply count per parent is exposed so the UI can show
	// "Show N more replies".
	const replies = topLevelIds.length === 0
		? []
		: await db
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
					isNotNull(comments.parentId),
					inArray(comments.parentId, topLevelIds)
				)
			)
			.orderBy(comments.createdAt);

	const replyCounts = new Map<string, number>();
	for (const r of replies) {
		if (!r.parentId) continue;
		replyCounts.set(r.parentId, (replyCounts.get(r.parentId) ?? 0) + 1);
	}

	// Build threaded structure. Per-parent cap (oldest replies kept; latest
	// dropped) — the API exposes the omitted count so the client can offer
	// "Load earlier replies" without a separate endpoint.
	const commentsWithReplies = topLevelComments.map((comment) => {
		const allReplies = replies.filter((r) => r.parentId === comment.id);
		const kept = allReplies.slice(-MAX_REPLIES_PER_PARENT);
		return {
			...comment,
			replies: kept,
			totalReplies: replyCounts.get(comment.id) ?? 0,
			repliesOmitted: Math.max(0, allReplies.length - kept.length)
		};
	});

	return json({ comments: commentsWithReplies });
	} catch (e) {
		console.error('[innovations/comments] load failed:', e);
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
	
	const commentId = crypto.randomUUID();
	
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
