/**
 * Tests for src/lib/server/retry.ts.
 */
import { describe, expect, test } from 'bun:test';
import { withRetries, isRetryableError } from '../src/lib/server/retry.ts';

describe('retry.isRetryableError', () => {
	test('429 / 503 / 500 are retryable', () => {
		expect(isRetryableError({ status: 429 })).toBe(true);
		expect(isRetryableError({ status: 503 })).toBe(true);
		expect(isRetryableError({ status: 500 })).toBe(true);
	});

	test('400 / 401 / 404 are not retryable', () => {
		expect(isRetryableError({ status: 400 })).toBe(false);
		expect(isRetryableError({ status: 401 })).toBe(false);
		expect(isRetryableError({ status: 404 })).toBe(false);
	});

	test('rate-limit / timeout messages are retryable', () => {
		expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true);
		expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true);
	});

	test('non-retryable error stops retries', async () => {
		let calls = 0;
		await expect(withRetries(async () => {
			calls++;
			throw new Error('bad request');
		}, { tries: 3, baseMs: 1, maxMs: 5 })).rejects.toThrow('bad request');
		expect(calls).toBe(1);
	});

	test('retryable error retries then gives up', async () => {
		let calls = 0;
		await expect(withRetries(async () => {
			calls++;
			throw { status: 503, message: 'unavailable' };
		}, { tries: 3, baseMs: 1, maxMs: 5 })).rejects.toBeDefined();
		expect(calls).toBe(3);
	});

	test('eventual success is returned', async () => {
		let calls = 0;
		const v = await withRetries(async () => {
			calls++;
			if (calls < 2) throw { status: 503, message: 'try later' };
			return 'ok';
		}, { tries: 3, baseMs: 1, maxMs: 5 });
		expect(v).toBe('ok');
		expect(calls).toBe(2);
	});
});
