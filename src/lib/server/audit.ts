/**
 * Audit log writer.
 *
 * Every privileged write (settings change, user role change, idea force-publish,
 * API token create/revoke) calls `audit({...})` with the request event so we
 * capture who, what, when, and from where.
 *
 * Design notes:
 *   - Fire-and-forget: the action returns success before the audit row is
 *     written. A failed write logs a warning but never fails the user action.
 *   - IP detection honours `x-forwarded-for` (first hop) when the deployment
 *     sits behind a trusted proxy. The portal already sets `X-Forwarded-*`
 *     headers; trusting them here is consistent with that.
 *   - `actorEmail` is denormalised so the audit trail survives a user delete
 *     (ON DELETE SET NULL on user_id).
 */
import { db, auditLog } from '$lib/server/db';
import { log } from '$lib/server/logger';
import type { AuditLog } from '$lib/server/db/schema';

interface MinimalEvent {
	request?: Request;
	locals?: { user?: { id: string; email: string } | null; reqId?: string };
	getClientAddress?: () => string;
	reqId?: string;
}

export interface AuditInput {
	event?: MinimalEvent;
	actor?: { id: string; email: string } | null;
	action: string;             // e.g. 'settings.update', 'user.role.change', 'api_token.create'
	targetType?: string;        // e.g. 'settings', 'user', 'api_token'
	targetId?: string | null;
	metadata?: Record<string, unknown>;
}

const MAX_IP_LEN = 64;       // x-forwarded-for can be long; truncate to a sane length
const MAX_UA_LEN = 512;
const MAX_EMAIL_LEN = 254;
const MAX_REQ_ID_LEN = 64;

function clientIpFromEvent(event: MinimalEvent | undefined): string | null {
	if (!event) return null;
	try {
		if (event.getClientAddress) {
			const a = event.getClientAddress();
			if (a) return a.slice(0, MAX_IP_LEN);
		}
	} catch {
		// getClientAddress throws outside a request context — fall through
	}
	if (event.request) {
		const xff = event.request.headers.get('x-forwarded-for');
		if (xff) return xff.split(',')[0]?.trim().slice(0, MAX_IP_LEN) ?? null;
		const real = event.request.headers.get('x-real-ip');
		if (real) return real.slice(0, MAX_IP_LEN);
	}
	return null;
}

function userAgentFromEvent(event: MinimalEvent | undefined): string | null {
	try {
		return event?.request?.headers.get('user-agent')?.slice(0, MAX_UA_LEN) ?? null;
	} catch {
		return null;
	}
}

function reqIdFromEvent(event: MinimalEvent | undefined): string | null {
	try {
		const v = event?.locals?.reqId ?? (event as { reqId?: string } | undefined)?.reqId;
		return v ? v.slice(0, MAX_REQ_ID_LEN) : null;
	} catch {
		return null;
	}
}

function actorFromEvent(event: MinimalEvent | undefined, explicit: AuditInput['actor']) {
	if (explicit) return { id: explicit.id, email: explicit.email };
	const u = event?.locals?.user;
	if (u) return { id: u.id, email: u.email };
	return null;
}

// Exported for unit tests only — do not call from request handlers.
export const _test = {
	clientIpFromEvent,
	userAgentFromEvent,
	reqIdFromEvent,
	actorFromEvent,
	MAX_IP_LEN,
	MAX_UA_LEN,
	MAX_REQ_ID_LEN,
	MAX_EMAIL_LEN
};

/**
 * Write an audit row. Returns the inserted row on success, null on failure.
 * Callers should not await this from request handlers — the fire-and-forget
 * helper `auditAsync` swallows the rejection.
 */
export async function audit(input: AuditInput): Promise<AuditLog | null> {
	const event = input.event;
	const actor = actorFromEvent(event, input.actor);
	const ip = clientIpFromEvent(event);
	const userAgent = userAgentFromEvent(event);
	const reqId = reqIdFromEvent(event);

	const row: typeof auditLog.$inferInsert = {
		id: crypto.randomUUID(),
		userId: actor?.id ?? null,
		actorEmail: actor?.email ? actor.email.slice(0, MAX_EMAIL_LEN) : null,
		action: input.action,
		targetType: input.targetType ?? null,
		targetId: input.targetId ?? null,
		metadata: input.metadata ? JSON.stringify(input.metadata) : null,
		ip,
		userAgent,
		reqId
	};

	try {
		const [inserted] = await db.insert(auditLog).values(row).returning();
		return inserted ?? null;
	} catch (e) {
		// Audit failures are warnings, not errors. The user action should still
		// succeed; an admin can re-derive the action from other logs if needed.
		log.warn('audit write failed', {
			action: input.action,
			err: e instanceof Error ? e.message : String(e)
		});
		return null;
	}
}

/**
 * Fire-and-forget variant for use in request handlers. Returns void; the
 * underlying write runs on its own promise.
 */
export function auditAsync(input: AuditInput): void {
	audit(input).catch(() => {
		// audit() already logs failures; this catch is just so the unhandled-
		// rejection handler doesn't see it.
	});
}
