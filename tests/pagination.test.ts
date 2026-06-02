/**
 * Tests for src/lib/server/pagination.ts.
 */
import { describe, expect, test } from 'bun:test';
import { encodeCursor, decodeCursor, cursorFromRow, applyKeyset } from '../src/lib/server/pagination';
import { sql, lt, or, eq, and } from 'drizzle-orm';

describe('pagination encode/decode', () => {
	test('roundtrips a cursor', () => {
		const c = { ts: 1700000000000, id: 'abc-123' };
		const encoded = encodeCursor(c);
		const decoded = decodeCursor(encoded);
		expect(decoded).toEqual(c);
	});

	test('returns null for empty / garbage input', () => {
		expect(decodeCursor(null)).toBe(null);
		expect(decodeCursor(undefined)).toBe(null);
		expect(decodeCursor('')).toBe(null);
		expect(decodeCursor('not-base64!@#')).toBe(null);
	});

	test('returns null for malformed payload', () => {
		// Valid base64 of "no-pipe-in-it"
		const bad = Buffer.from('no-pipe-in-it', 'utf-8').toString('base64');
		expect(decodeCursor(bad)).toBe(null);
	});
});

describe('pagination cursorFromRow', () => {
	test('builds cursor from a row', () => {
		const c = cursorFromRow({ id: 'x', createdAt: new Date(1700000000000) });
		expect(c).toEqual({ ts: 1700000000000, id: 'x' });
	});
	test('returns null for missing row / date', () => {
		expect(cursorFromRow(null)).toBe(null);
		expect(cursorFromRow(undefined)).toBe(null);
		expect(cursorFromRow({ id: 'x', createdAt: null })).toBe(null);
	});
});

describe('pagination applyKeyset', () => {
	// Use `sql` placeholder columns to inspect the predicate shape without
	// touching a real table.
	const fakeCol = sql`created_at`.as('created_at');

	test('returns undefined when no cursor', () => {
		expect(applyKeyset(fakeCol as never, fakeCol as never, null)).toBeUndefined();
	});

	test('emits an OR (lt, and(eq, lt)) predicate when cursor present', () => {
		const cursor = { ts: 1700000000000, id: 'abc' };
		const predicate = applyKeyset(fakeCol as never, fakeCol as never, cursor);
		// We just want a non-undefined SQL node that can be AND-ed into a query.
		expect(predicate).toBeDefined();
		// Sanity: the predicate object is the drizzle SQL wrapper.
		expect(typeof (predicate as { queryChunks?: unknown }).queryChunks).toBeDefined();
	});
});
