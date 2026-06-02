/**
 * API tokens for the current user.
 *
 *  GET  /api/account/tokens          — list the caller's tokens (preview only)
 *  POST /api/account/tokens          — create a new token; returns the raw value ONCE
 *  DELETE /api/account/tokens/[id]   — revoke one of the caller's tokens
 *
 * Admin can revoke any token by passing `?actor=<userId>` in the DELETE body —
 * useful when revoking a compromised service token whose owner is unavailable.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createToken, listTokensForUser, revokeToken } from '$lib/server/services/apiTokens';
import { auditAsync } from '$lib/server/audit';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');
	const tokens = await listTokensForUser(locals.user.id);
	return json({ tokens });
};

export const POST: RequestHandler = async (event) => {
	const { request, locals } = event;
	if (!locals.user) throw error(401, 'Unauthorized');

	let body: { name?: unknown; ttlDays?: unknown; scopes?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	if (!name) throw error(400, 'Token name is required');
	const ttlDays = typeof body.ttlDays === 'number' ? body.ttlDays : undefined;
	const scopes = Array.isArray(body.scopes)
		? body.scopes.filter((s): s is string => typeof s === 'string')
		: undefined;

	const token = await createToken(locals.user.id, { name, ttlDays, scopes });

	auditAsync({
		event,
		action: 'api_token.create',
		targetType: 'api_token',
		targetId: token.id,
		metadata: { name, scopes: token.scopes, expiresAt: token.expiresAt?.toISOString() }
	});

	// rawToken is returned exactly once; the UI must show it then forget it.
	return json({ token });
};

export const DELETE: RequestHandler = async (event) => {
	const { request, locals } = event;
	if (!locals.user) throw error(401, 'Unauthorized');

	let body: { tokenId?: unknown; targetUserId?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}
	const tokenId = typeof body.tokenId === 'string' ? body.tokenId : '';
	if (!tokenId) throw error(400, 'tokenId is required');

	const isAdmin = locals.user.role === 'admin';
	// Admin can pass targetUserId to revoke on behalf of another user (compromised
	// token case). Non-admin can only revoke their own.
	let ownerUserId: string | null = locals.user.id;
	if (isAdmin && typeof body.targetUserId === 'string' && body.targetUserId !== locals.user.id) {
		const [target] = await db
			.select({ id: users.id, email: users.email })
			.from(users)
			.where(eq(users.id, body.targetUserId))
			.limit(1);
		if (!target) throw error(404, 'Target user not found');
		ownerUserId = body.targetUserId;
	}

	const ok = await revokeToken(tokenId, { userId: ownerUserId, isAdmin });
	if (!ok) throw error(404, 'Token not found or already revoked');

	auditAsync({
		event,
		action: isAdmin && ownerUserId !== locals.user.id
			? 'api_token.revoke_by_admin'
			: 'api_token.revoke',
		targetType: 'api_token',
		targetId: tokenId,
		metadata: { ownerUserId }
	});

	return json({ success: true });
};
