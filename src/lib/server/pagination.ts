/**
 * Keyset (a.k.a. cursor) pagination helpers.
 *
 * Replaces `LIMIT/OFFSET` for list endpoints that scan a stable, indexed
 * sort column (typically `createdAt`). Keyset is O(log n) per page regardless
 * of depth, while OFFSET degrades linearly.
 *
 * The cursor encodes `(timestamp, id)` so it's stable across rows with the
 * same timestamp. The query is `WHERE (ts, id) < (cursorTs, cursorId)`,
 * order desc — see `applyKeyset()`.
 */
import { and, lt, or, eq, type SQL } from 'drizzle-orm';

export interface KeysetCursor {
	ts: number; // unix ms
	id: string;
}

export function encodeCursor(cursor: KeysetCursor): string {
	// base64url so cursors are URL-safe without escaping
	return Buffer.from(`${cursor.ts}|${cursor.id}`, 'utf-8')
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export function decodeCursor(raw: string | null | undefined): KeysetCursor | null {
	if (!raw) return null;
	try {
		const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
		const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
		const decoded = Buffer.from(b64 + pad, 'base64').toString('utf-8');
		const [tsStr, id] = decoded.split('|');
		const ts = Number(tsStr);
		if (!Number.isFinite(ts) || !id) return null;
		return { ts, id };
	} catch {
		return null;
	}
}

/**
 * Apply a keyset predicate to a list query.
 *
 *   WHERE (ts < :cursorTs) OR (ts = :cursorTs AND id < :cursorId)
 *
 * Combine with the rest of the WHERE conditions via `and(...)`.
 */
export function applyKeyset(
	tsCol: Parameters<typeof lt>[0],
	idCol: Parameters<typeof lt>[0],
	cursor: KeysetCursor | null
): SQL | undefined {
	if (!cursor) return undefined;
	const cursorDate = new Date(cursor.ts);
	return or(
		lt(tsCol, cursorDate),
		and(eq(tsCol, cursorDate), lt(idCol, cursor.id))
	);
}

/** Build a cursor from the last row of a descending-by-ts result. */
export function cursorFromRow(row: { createdAt: Date | null; id: string } | null | undefined): KeysetCursor | null {
	if (!row || !row.createdAt) return null;
	return { ts: row.createdAt.getTime(), id: row.id };
}
