import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, auditLog } from '$lib/server/db';
import { desc, like, and, or, eq } from 'drizzle-orm';
import { safeParseJSON } from '$lib/server/services/ideasUtils';

const MAX_ROWS = 200;

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user || locals.user.role !== 'admin') {
		throw error(403, 'Admins only');
	}

	const actor = url.searchParams.get('actor')?.trim() || '';
	const action = url.searchParams.get('action')?.trim() || '';
	const targetType = url.searchParams.get('targetType')?.trim() || '';

	const conditions = [];
	if (actor) {
		conditions.push(or(like(auditLog.actorEmail, `%${actor}%`), like(auditLog.userId, `%${actor}%`)));
	}
	if (action) conditions.push(like(auditLog.action, `%${action}%`));
	if (targetType) conditions.push(eq(auditLog.targetType, targetType));

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			id: auditLog.id,
			actorEmail: auditLog.actorEmail,
			userId: auditLog.userId,
			action: auditLog.action,
			targetType: auditLog.targetType,
			targetId: auditLog.targetId,
			metadata: auditLog.metadata,
			ip: auditLog.ip,
			userAgent: auditLog.userAgent,
			reqId: auditLog.reqId,
			createdAt: auditLog.createdAt
		})
		.from(auditLog)
		.where(where)
		.orderBy(desc(auditLog.createdAt))
		.limit(MAX_ROWS);

	return {
		filters: { actor, action, targetType },
		entries: rows.map((r) => ({
			...r,
			createdAt: r.createdAt?.toISOString() ?? null,
			metadata: r.metadata ? safeParseJSON<Record<string, unknown>>(r.metadata) : null
		}))
	};
};
