/**
 * Bearer-token authentication for API routes.
 *
 * Routes that need to be reachable from external tooling (curl, CI, an AI
 * agent) accept `Authorization: Bearer ircap_…` in addition to (or in
 * place of) the portal session cookie. When the bearer token is valid, we
 * populate `event.locals.user` so downstream handlers don't need a separate
 * code path.
 */
import type { RequestEvent } from '@sveltejs/kit';
import { findValidToken } from '$lib/server/services/apiTokens';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { SessionUser } from '$lib/server/services/auth';

const BEARER_RE = /^Bearer\s+(\S+)$/i;

/**
 * Extract the bearer token from the Authorization header (case-insensitive).
 * Returns the raw token (without the `Bearer ` prefix) or null.
 */
export function extractBearerToken(request: Request): string | null {
	const auth = request.headers.get('authorization');
	if (!auth) return null;
	const match = BEARER_RE.exec(auth);
	return match ? match[1] : null;
}

/**
 * Look up the user behind a bearer token, or return null if the token is
 * missing / unknown / revoked / expired.
 */
export async function userFromBearer(request: Request): Promise<SessionUser | null> {
	const raw = extractBearerToken(request);
	if (!raw) return null;
	const token = await findValidToken(raw);
	if (!token) return null;
	const [row] = await db
		.select({
			id: users.id,
			email: users.email,
			name: users.name,
			avatarUrl: users.avatarUrl,
			role: users.role,
			department: users.department
		})
		.from(users)
		.where(eq(users.id, token.userId))
		.limit(1);
	if (!row) return null;
	return {
		id: row.id,
		email: row.email,
		name: row.name,
		avatarUrl: row.avatarUrl,
		role: row.role as SessionUser['role'],
		department: row.department as SessionUser['department']
	};
}
