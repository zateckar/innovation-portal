/**
 * SSRF guard for user-submitted URLs.
 *
 * Rejects:
 *   - non-http(s) schemes (file:, data:, javascript:, gopher:, etc.)
 *   - URLs longer than MAX_URL_LENGTH
 *   - hostnames that resolve (via DNS lookup) to a private/loopback/link-local/
 *     cloud-metadata IP — including the cloud metadata endpoints 169.254.169.254
 *     and 169.254.170.2
 *
 * Returns the normalised URL on success, throws a user-safe Error on rejection.
 *
 * NOTE: this is one layer of defence — the caller should also time out the
 * actual fetch and never echo the resolved IP into redirects.
 */
import { lookup } from 'dns/promises';
import { isIP } from 'net';

export const MAX_URL_LENGTH = 2048;

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
	[ip4('10.0.0.0'), ip4('10.255.255.255')],
	[ip4('172.16.0.0'), ip4('172.31.255.255')],
	[ip4('192.168.0.0'), ip4('192.168.255.255')],
	[ip4('127.0.0.0'), ip4('127.255.255.255')],
	[ip4('169.254.0.0'), ip4('169.254.255.255')],
	[ip4('100.64.0.0'), ip4('100.127.255.255')],
	[ip4('0.0.0.0'), ip4('0.255.255.255')]
];

function ip4(s: string): number {
	return s.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isPrivateIPv4(addr: string): boolean {
	const n = ip4(addr);
	return PRIVATE_IPV4_RANGES.some(([lo, hi]) => n >= lo && n <= hi);
}

function isPrivateIPv6(addr: string): boolean {
	const lower = addr.toLowerCase();
	if (lower === '::1' || lower === '::') return true;
	if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
	if (lower.startsWith('fe80:')) return true; // link-local
	// IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1, ::ffff:10.0.0.1) — strip the
	// prefix and delegate to the v4 private check so 169.254.169.254 can't
	// sneak past via the mapped form.
	if (lower.startsWith('::ffff:')) {
		const tail = lower.slice(7);
		if (isIP(tail) === 4) return isPrivateIPv4(tail);
	}
	return false;
}

function isPrivateAddress(addr: string): boolean {
	const family = isIP(addr);
	if (family === 4) return isPrivateIPv4(addr);
	if (family === 6) return isPrivateIPv6(addr);
	return true; // unknown — fail closed
}

export interface SafeUrlResult {
	url: URL;
	resolvedAddress: string;
}

export async function assertSafeUrl(input: string): Promise<SafeUrlResult> {
	if (typeof input !== 'string') {
		throw new Error('URL must be a string');
	}
	if (input.length > MAX_URL_LENGTH) {
		throw new Error(`URL is too long (max ${MAX_URL_LENGTH} characters)`);
	}

	let url: URL;
	try {
		url = new URL(input);
	} catch {
		throw new Error('Please enter a valid URL');
	}

	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new Error('URL must use http or https');
	}

	const hostname = url.hostname;
	// If the hostname is already a literal IP, check it directly (no DNS lookup).
	if (isIP(hostname)) {
		if (isPrivateAddress(hostname)) {
			throw new Error('URL points to a private or reserved address range');
		}
		return { url, resolvedAddress: hostname };
	}

	// Otherwise, resolve via DNS and verify ALL returned addresses (an attacker
	// could publish multiple A records, some of which are public — reject if
	// ANY of them is private).
	let records: Array<{ address: string; family: number }>;
	try {
		records = await lookup(hostname, { all: true, verbatim: true });
	} catch {
		throw new Error('Could not resolve the URL hostname');
	}

	if (records.length === 0) {
		throw new Error('URL hostname did not resolve to any address');
	}

	for (const r of records) {
		if (isPrivateAddress(r.address)) {
			throw new Error('URL points to a private or reserved address range');
		}
	}

	// Use the first address as the canonical resolved address for callers that
	// want to pin a specific IP (defence in depth).
	return { url, resolvedAddress: records[0].address };
}
