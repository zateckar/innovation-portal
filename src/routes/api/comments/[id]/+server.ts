import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, comments } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';

// Recursively find all descendant comment IDs
async function getDescendantIds(parentId: string): Promise<string[]> {
	const children = await db
		.select({ id: comments.id })
		.from(comments)
		.where(eq(comments.parentId, parentId));
	
	const ids = children.map(c => c.id);
	for (const childId of ids) {
		ids.push(...await getDescendantIds(childId));
	}
	return ids;
}

// Delete a comment
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	
	try {
	const commentId = params.id;
	
	// Get the comment
	const [comment] = await db
		.select()
		.from(comments)
		.where(eq(comments.id, commentId));
	
	if (!comment) {
		return json({ error: 'Comment not found' }, { status: 404 });
	}
	
	// Only the comment author or admin can delete
	if (comment.userId !== locals.user.id && locals.user.role !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}
	
	// Recursively find all descendant comment IDs and delete them all
	const descendantIds = await getDescendantIds(commentId);
	const allIds = [commentId, ...descendantIds];
	
	if (allIds.length > 0) {
		await db.delete(comments).where(inArray(comments.id, allIds));
	}
	
	return json({ success: true });
	} catch {
		return json({ error: 'Failed to delete comment' }, { status: 500 });
	}
};

// Update a comment
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	
	try {
	const commentId = params.id;
	
	// Get the comment
	const [comment] = await db
		.select()
		.from(comments)
		.where(eq(comments.id, commentId));
	
	if (!comment) {
		return json({ error: 'Comment not found' }, { status: 404 });
	}
	
	// Only the comment author can edit
	if (comment.userId !== locals.user.id) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}
	
	const body = await request.json();
	const { content } = body;
	
	if (!content || typeof content !== 'string' || content.trim().length === 0) {
		return json({ error: 'Comment content is required' }, { status: 400 });
	}
	
	if (content.length > 2000) {
		return json({ error: 'Comment is too long (max 2000 characters)' }, { status: 400 });
	}
	
	await db.update(comments)
		.set({ 
			content: content.trim(),
			updatedAt: new Date()
		})
		.where(eq(comments.id, commentId));
	
	return json({ success: true });
	} catch {
		return json({ error: 'Failed to update comment' }, { status: 500 });
	}
};
