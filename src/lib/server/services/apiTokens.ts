/**
 * Per-user API tokens used for long-running deploys (REVIEW.md §3.6).
 *
 * Model:
 *   - `createToken()` returns the raw token exactly ONCE. From then on we
 *     only keep its SHA-256 hash and a short preview ("abcd1234…") for
 *     display in the user-facing UI.
 *   - Tokens have an optional expiry. After `expiresAt` passes, `findValidToken`
 *     rejects them just like a revoked token — no separate "expired" state.
 *   - `findValidToken(rawToken)` is the only path callers should use to
 *     authenticate a request with a bearer token. It does the hash lookup,
 *     the not-revoked check, the not-expired check, and bumps `lastUsedAt`.
 *   - We do not enforce scopes today; the column is in place for the
 *     future "scoped deploy tokens" feature.
 */
import { db, apiTokens, type ApiToken } from '$lib/server/db';
import { and, eq, isNull, gt } from 'drizzle-orm';
import { createHash, randomBytes } from 'crypto';

export const TOKEN_PREFIX = 'ircap_'; // "innovation-radar API token"
const PREVIEW_LEN = 8;
const DEFAULT_TTL_DAYS = 365;
const MAX_TTL_DAYS = 365 * 5;        // 5 years — sanity cap

function sha256Hex(raw: string): string {
	return createHash('sha256').update(raw, 'utf-8').digest('hex');
}

export interface CreateTokenOptions {
	name: string;
	scopes?: string[];                // default: ['deploy']
	ttlDays?: number;                 // default: 365
}

export interface CreateTokenResult {
	id: string;
	rawToken: string;                 // shown ONCE — caller must surface to user
	preview: string;                  // first PREVIEW_LEN chars of raw
	scopes: string[];
	expiresAt: Date | null;
	createdAt: Date;
}

export async function createToken(
	userId: string,
	options: CreateTokenOptions
): Promise<CreateTokenResult> {
	if (!options.name || options.name.trim().length === 0) {
		throw new Error('Token name is required');
	}
	const ttlDays = Math.min(
		Math.max(1, options.ttlDays ?? DEFAULT_TTL_DAYS),
		MAX_TTL_DAYS
	);
	const scopes = options.scopes ?? ['deploy'];

	// 32 random bytes → 256 bits of entropy, base64url-encoded → 43 chars.
	// Prefix the raw token so it is recognisable in logs / accidental leaks.
	const raw = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
	const preview = raw.slice(0, PREVIEW_LEN);
	const tokenHash = sha256Hex(raw);
	const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

	const id = crypto.randomUUID();
	const now = new Date();

	await db.insert(apiTokens).values({
		id,
		userId,
		name: options.name.trim().slice(0, 120),
		tokenHash,
		tokenPreview: preview,
		scopes: JSON.stringify(scopes),
		expiresAt,
		createdAt: now
	});

	return { id, rawToken: raw, preview, scopes, expiresAt, createdAt: now };
}

export interface ValidatedToken {
	id: string;
	userId: string;
	name: string;
	scopes: string[];
}

/**
 * Look up a token by its raw form. Returns the validated row or `null` when
 * the token is unknown / revoked / expired. Bumps `lastUsedAt` on a hit.
 *
 * The `lastUsedAt` write is fire-and-forget — a slow audit row must not
 * block the deploy request that triggered the lookup.
 */
export async function findValidToken(rawToken: string | null | undefined): Promise<ValidatedToken | null> {
	if (!rawToken || !rawToken.startsWith(TOKEN_PREFIX)) return null;
	const tokenHash = sha256Hex(rawToken);

	const rows = await db
		.select()
		.from(apiTokens)
		.where(eq(apiTokens.tokenHash, tokenHash))
		.limit(1);
	const row = rows[0];
	if (!row) return null;
	if (row.revokedAt) return null;
	if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null;

	// Bump lastUsedAt — best-effort, never awaited by the caller path.
	db.update(apiTokens)
		.set({ lastUsedAt: new Date() })
		.where(eq(apiTokens.id, row.id))
		.catch(() => {
			// Non-critical; ignore
		});

	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		scopes: safeParseScopes(row.scopes)
	};
}

function safeParseScopes(raw: string | null | undefined): string[] {
	if (!raw) return [];
	try {
		const v = JSON.parse(raw);
		return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

/** List a user's tokens (preview only — never the raw or the hash). */
export async function listTokensForUser(userId: string): Promise<Array<{
	id: string;
	name: string;
	preview: string;
	scopes: string[];
	expiresAt: Date | null;
	lastUsedAt: Date | null;
	createdAt: Date | null;
	revokedAt: Date | null;
}>> {
	const rows = await db
		.select({
			id: apiTokens.id,
			name: apiTokens.name,
			tokenPreview: apiTokens.tokenPreview,
			scopes: apiTokens.scopes,
			expiresAt: apiTokens.expiresAt,
			lastUsedAt: apiTokens.lastUsedAt,
			createdAt: apiTokens.createdAt,
			revokedAt: apiTokens.revokedAt
		})
		.from(apiTokens)
		.where(eq(apiTokens.userId, userId));

	return rows
		.map((r) => ({
			id: r.id,
			name: r.name,
			preview: r.tokenPreview,
			scopes: safeParseScopes(r.scopes),
			expiresAt: r.expiresAt,
			lastUsedAt: r.lastUsedAt,
			createdAt: r.createdAt,
			revokedAt: r.revokedAt
		}))
		.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/**
 * Revoke a token. Returns true if a row was updated, false if the token
 * doesn't exist or doesn't belong to the user. Admin callers can pass
 * `userId: null` to revoke any token.
 */
export async function revokeToken(
	tokenId: string,
	opts: { userId?: string | null; isAdmin?: boolean } = {}
): Promise<boolean> {
	if (!tokenId) return false;
	const conditions = opts.isAdmin
		? and(eq(apiTokens.id, tokenId), isNull(apiTokens.revokedAt))
		: and(
				eq(apiTokens.id, tokenId),
				eq(apiTokens.userId, opts.userId ?? '__no_user__'),
				isNull(apiTokens.revokedAt)
			);
	const result = await db
		.update(apiTokens)
		.set({ revokedAt: new Date() })
		.where(conditions);
	// drizzle returns a "result" object; on SQLite it has `changes`
	return (result as unknown as { changes?: number }).changes === 1;
}

export function hashTokenForTest(raw: string): string {
	return sha256Hex(raw);
}
