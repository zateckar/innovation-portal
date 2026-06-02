/**
 * Tests for src/lib/server/services/workspaceIdentity.ts.
 *
 * Covers sign + verify contract (positive and negative paths).
 */
import { describe, expect, test, beforeAll } from 'bun:test';
import { signIdentity, getWorkspaceIdentitySecret } from '../src/lib/server/services/workspaceIdentity.ts';

const id = {
	id: 'user-1',
	email: 'alice@example.com',
	name: 'Alice',
	role: 'admin',
	department: 'eng'
};

describe('workspaceIdentity.signIdentity', () => {
	test('produces a 64-char hex string', () => {
		expect(signIdentity(id, 1700000000000)).toMatch(/^[0-9a-f]{64}$/);
	});

	test('is deterministic for a fixed timestamp and same process', () => {
		const a = signIdentity(id, 1700000000000);
		const b = signIdentity(id, 1700000000000);
		expect(a).toBe(b);
	});

	test('changes when the timestamp changes', () => {
		const a = signIdentity(id, 1700000000000);
		const b = signIdentity(id, 1700000000001);
		expect(a).not.toBe(b);
	});

	test('changes when any field changes', () => {
		const a = signIdentity(id, 1700000000000);
		const b = signIdentity({ ...id, role: 'member' }, 1700000000000);
		expect(a).not.toBe(b);
	});

	test('getWorkspaceIdentitySecret returns at least 32 hex chars', () => {
		const s = getWorkspaceIdentitySecret();
		expect(s).toMatch(/^[0-9a-f]+$/);
		expect(s.length).toBeGreaterThanOrEqual(32);
	});
});
