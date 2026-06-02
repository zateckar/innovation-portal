/**
 * Tests for src/lib/server/urlSafety.ts.
 *
 * Covers the SSRF guard. DNS-dependent cases are best-effort (skip on
 * platforms where the test runner can't reach DNS); literal-IP cases are
 * deterministic and form the bulk of the assertions.
 */
import { describe, expect, test } from 'bun:test';
import { assertSafeUrl } from '../src/lib/server/urlSafety.ts';

describe('urlSafety.assertSafeUrl', () => {
	test('accepts an http URL with a public-looking hostname', () => {
		expect(() => assertSafeUrl('http://example.com/foo')).not.toThrow();
		expect(() => assertSafeUrl('https://example.com/')).not.toThrow();
	});

	test('rejects non-http(s) schemes', () => {
		expect(() => assertSafeUrl('file:///etc/passwd')).toThrow();
		expect(() => assertSafeUrl('javascript:alert(1)')).toThrow();
		expect(() => assertSafeUrl('data:text/plain,hi')).toThrow();
	});

	test('rejects literal loopback / private / link-local IPv4', () => {
		expect(() => assertSafeUrl('http://127.0.0.1/')).toThrow();
		expect(() => assertSafeUrl('http://10.0.0.1/')).toThrow();
		expect(() => assertSafeUrl('http://192.168.1.1/')).toThrow();
		expect(() => assertSafeUrl('http://169.254.169.254/latest/meta-data')).toThrow();
	});

	test('rejects IPv4-mapped loopback v6 (::ffff:127.0.0.1)', () => {
		expect(() => assertSafeUrl('http://[::ffff:127.0.0.1]/')).toThrow();
	});

	test('rejects IPv6 loopback and link-local', () => {
		expect(() => assertSafeUrl('http://[::1]/')).toThrow();
		expect(() => assertSafeUrl('http://[fe80::1]/')).toThrow();
		expect(() => assertSafeUrl('http://[fc00::1]/')).toThrow();
	});

	test('rejects empty / too long', () => {
		expect(() => assertSafeUrl('')).toThrow();
		const long = 'https://example.com/' + 'a'.repeat(5000);
		expect(() => assertSafeUrl(long)).toThrow();
	});
});
