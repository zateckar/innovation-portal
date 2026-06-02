/**
 * Tests for src/lib/server/crypto/secrets.ts.
 *
 * Covers:
 *   - encryptSecret/decryptSecret roundtrip
 *   - decryptSecret legacy plaintext passthrough
 *   - prefix detection
 *   - wrong-key failure mode
 */
import { describe, expect, test, beforeAll } from 'bun:test';
import { encryptSecret, decryptSecret, resetCryptoCache } from '../src/lib/server/crypto/secrets.ts';

beforeAll(() => {
	// 64 hex chars = 32 bytes — required for AES-256-GCM
	process.env.APP_ENCRYPTION_KEY = 'a'.repeat(64);
});

describe('crypto/secrets', () => {
	test('roundtrips arbitrary text', () => {
		const plain = 'sk-gemini-1234567890-ABCDEFG';
		const enc = encryptSecret(plain)!;
		expect(enc).not.toBe(plain);
		expect(enc.startsWith('enc:v1:')).toBe(true);
		expect(decryptSecret(enc)).toBe(plain);
	});

	test('legacy plaintext passes through unchanged', () => {
		const plain = 'unencrypted-legacy-value';
		expect(plain.startsWith('enc:v1:')).toBe(false);
		expect(decryptSecret(plain)).toBe(plain);
	});

	test('two encryptions of the same plaintext differ (random IV)', () => {
		const plain = 'repeat-this';
		const a = encryptSecret(plain)!;
		const b = encryptSecret(plain)!;
		expect(a).not.toBe(b);
		expect(decryptSecret(a)).toBe(plain);
		expect(decryptSecret(b)).toBe(plain);
	});

	test('wrong key fails to decrypt', () => {
		const enc = encryptSecret('top-secret')!;
		const saved = process.env.APP_ENCRYPTION_KEY;
		process.env.APP_ENCRYPTION_KEY = 'b'.repeat(64);
		resetCryptoCache();
		try {
			expect(() => decryptSecret(enc)).toThrow();
		} finally {
			process.env.APP_ENCRYPTION_KEY = saved;
			resetCryptoCache();
		}
	});
});
