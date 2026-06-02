/**
 * Tests for src/lib/server/services/deployment.ts.
 *
 * Covers the pure helpers that don't touch the DB:
 *   - generateRandomSuffix (CSPRNG, length honour)
 *   - createDeploymentContext + resolveTemplate substitution
 */
import { describe, expect, test } from 'bun:test';
import {
	generateRandomSuffix,
	createDeploymentContext,
	resolveTemplate
} from '../src/lib/server/services/deployment.ts';

describe('deployment.generateRandomSuffix', () => {
	test('returns hex string of the requested length', () => {
		expect(generateRandomSuffix(8)).toMatch(/^[0-9a-f]{8}$/);
		expect(generateRandomSuffix(12)).toMatch(/^[0-9a-f]{12}$/);
	});

	test('two calls produce different values (CSPRNG, not Math.random)', () => {
		const seen = new Set<string>();
		for (let i = 0; i < 10; i++) seen.add(generateRandomSuffix(8));
		expect(seen.size).toBe(10);
	});
});

describe('deployment.resolveTemplate', () => {
	const ctx = createDeploymentContext(
		{ id: 'u-1', email: 'alice@example.com', name: 'Alice' },
		{ id: 'cat-1', slug: 'demo-app' }
	);

	test('substitutes known variables', () => {
		const out = resolveTemplate('{{username}}-{{catalog_item_name}}-{{random_suffix}}', ctx);
		expect(out).toContain('alice-demo-app-');
		expect(out).toMatch(/^[a-z0-9-]+$/);
	});

	test('leaves unknown placeholders intact', () => {
		const out = resolveTemplate('{{unknown_var}}', ctx);
		expect(out).toBe('{{unknown_var}}');
	});

	test('username is sanitized for K8s', () => {
		const user = { id: 'u', email: 'Bob.Smith+test@x.io', name: 'Bob' } as const;
		const c = createDeploymentContext(user, { id: 'c', slug: 's' });
		expect(c.username).toBe('bob-smith-test');
	});
});
