/**
 * Centralised, TTL-cached access to the singleton `settings` row.
 *
 * Almost every service reads `SELECT * FROM settings WHERE id='default'`
 * (ideas, news, trends, scanner, jira, ado, ai, oidc). On the original
 * implementation, each of those calls hit SQLite directly. With 10+ callers
 * and a single row, that's both wasted IO and a footgun: a future caller that
 * forgets the WHERE clause will silently return empty results.
 *
 * The cache:
 *   - has a 30s default TTL (override via `{ ttlMs }`)
 *   - returns `null` for the missing row, just like the underlying query
 *   - is invalidated synchronously via `bumpSettingsCache()` from the admin
 *     save action so admin-driven changes are visible immediately
 *   - is process-local (multi-process deployments are unaffected)
 */
import { db, settings, type Settings } from '$lib/server/db';
import { eq } from 'drizzle-orm';

let cache: { value: Settings | null; expiresAt: number } | null = null;
const DEFAULT_TTL_MS = 30_000;

export async function getSettings(opts: { ttlMs?: number } = {}): Promise<Settings | null> {
	const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
	const now = Date.now();
	if (cache && cache.expiresAt > now) {
		return cache.value;
	}
	const [row] = await db.select().from(settings).where(eq(settings.id, 'default'));
	cache = { value: row ?? null, expiresAt: now + ttlMs };
	return cache.value;
}

/**
 * Invalidate the cache. Called by the admin settings save action so an
 * updated row is visible to the very next request, regardless of TTL.
 * Safe to call from anywhere; no-op if the cache is cold.
 */
export function bumpSettingsCache(): void {
	cache = null;
}
