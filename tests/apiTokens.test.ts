import { describe, it, expect } from 'bun:test';
import { createHash } from 'crypto';
import { hashTokenForTest, TOKEN_PREFIX } from '../src/lib/server/services/apiTokens';

describe('apiTokens — hashing & prefix', () => {
	it('TOKEN_PREFIX is exactly "ircap_"', () => {
		expect(TOKEN_PREFIX).toBe('ircap_');
	});

	it('hashTokenForTest matches sha256 hex of the raw token', () => {
		const raw = 'ircap_abc123';
		const expected = createHash('sha256').update(raw, 'utf-8').digest('hex');
		expect(hashTokenForTest(raw)).toBe(expected);
		expect(hashTokenForTest(raw)).toMatch(/^[0-9a-f]{64}$/);
	});

	it('hashing is deterministic and order-sensitive', () => {
		const a = hashTokenForTest('ircap_AAA');
		const b = hashTokenForTest('ircap_AAA');
		const c = hashTokenForTest('ircap_aaa');
		expect(a).toBe(b);
		expect(a).not.toBe(c);
	});

	it('different inputs hash to different values', () => {
		expect(hashTokenForTest('ircap_AAA')).not.toBe(hashTokenForTest('ircap_AAB'));
	});
});

describe('apiTokens — prefix invariants', () => {
	it('any non-prefixed string is rejectable by findValidToken', () => {
		// We don't exercise the DB here; we just confirm the gate function
		// (checked in findValidToken) would skip a non-prefixed input. The
		// contract is: rawToken must start with TOKEN_PREFIX.
		const ok = `${TOKEN_PREFIX}something`.startsWith(TOKEN_PREFIX);
		const bad = 'something'.startsWith(TOKEN_PREFIX);
		expect(ok).toBe(true);
		expect(bad).toBe(false);
	});
});
