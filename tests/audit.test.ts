import { describe, it, expect } from 'bun:test';
import { _test } from '../src/lib/server/audit';
import type { AuditInput } from '../src/lib/server/audit';

const { clientIpFromEvent, userAgentFromEvent, reqIdFromEvent, actorFromEvent, MAX_IP_LEN, MAX_UA_LEN, MAX_EMAIL_LEN } = _test;

function makeRequest(headers: Record<string, string> = {}): Request {
	return new Request('https://example.com', { headers });
}

describe('audit — clientIpFromEvent', () => {
	it('returns null when no event', () => {
		expect(clientIpFromEvent(undefined)).toBeNull();
	});

	it('prefers x-forwarded-for (first hop) over x-real-ip', () => {
		const req = makeRequest({
			'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2',
			'x-real-ip': '198.51.100.7'
		});
		expect(clientIpFromEvent({ request: req })).toBe('203.0.113.5');
	});

	it('falls back to x-real-ip when no x-forwarded-for', () => {
		const req = makeRequest({ 'x-real-ip': '198.51.100.7' });
		expect(clientIpFromEvent({ request: req })).toBe('198.51.100.7');
	});

	it('falls back to getClientAddress() when no headers', () => {
		expect(
			clientIpFromEvent({ getClientAddress: () => '10.1.2.3' })
		).toBe('10.1.2.3');
	});

	it('prefers getClientAddress() over headers (more authoritative)', () => {
		const req = makeRequest({ 'x-forwarded-for': '203.0.113.5' });
		expect(
			clientIpFromEvent({ request: req, getClientAddress: () => '10.1.2.3' })
		).toBe('10.1.2.3');
	});

	it('returns null when getClientAddress throws and no headers', () => {
		expect(
			clientIpFromEvent({
				getClientAddress: () => {
					throw new Error('not in a request');
				}
			})
		).toBeNull();
	});

	it('truncates overlong x-forwarded-for entries', () => {
		const huge = 'a'.repeat(MAX_IP_LEN + 50);
		const req = makeRequest({ 'x-forwarded-for': huge });
		expect(clientIpFromEvent({ request: req })?.length).toBe(MAX_IP_LEN);
	});

	it('trims whitespace in x-forwarded-for', () => {
		const req = makeRequest({ 'x-forwarded-for': '  203.0.113.5  ,  10.0.0.1' });
		expect(clientIpFromEvent({ request: req })).toBe('203.0.113.5');
	});
});

describe('audit — userAgentFromEvent', () => {
	it('returns null when no request', () => {
		expect(userAgentFromEvent(undefined)).toBeNull();
	});

	it('reads user-agent header verbatim (modulo truncation)', () => {
		const ua = 'Mozilla/5.0 (Test)';
		const req = makeRequest({ 'user-agent': ua });
		expect(userAgentFromEvent({ request: req })).toBe(ua);
	});

	it('truncates overlong UAs', () => {
		const req = makeRequest({ 'user-agent': 'x'.repeat(MAX_UA_LEN + 100) });
		expect(userAgentFromEvent({ request: req })?.length).toBe(MAX_UA_LEN);
	});
});

describe('audit — reqIdFromEvent', () => {
	it('reads from event.locals.reqId first', () => {
		expect(reqIdFromEvent({ locals: { reqId: 'abc-123' } })).toBe('abc-123');
	});

	it('falls back to top-level event.reqId', () => {
		expect(reqIdFromEvent({ reqId: 'top-level' })).toBe('top-level');
	});

	it('returns null when neither is set', () => {
		expect(reqIdFromEvent({})).toBeNull();
		expect(reqIdFromEvent(undefined)).toBeNull();
	});

	it('truncates overlong reqIds', () => {
		const long = 'r'.repeat(200);
		expect(reqIdFromEvent({ reqId: long })?.length).toBe(_test.MAX_REQ_ID_LEN);
	});
});

describe('audit — actorFromEvent', () => {
	it('prefers explicit actor over locals.user', () => {
		const explicit = { id: 'u1', email: 'explicit@example.com' };
		expect(
			actorFromEvent({ locals: { user: { id: 'u2', email: 'locals@example.com' } } }, explicit)
		).toEqual(explicit);
	});

	it('falls back to locals.user', () => {
		expect(
			actorFromEvent({ locals: { user: { id: 'u2', email: 'locals@example.com' } } }, undefined)
		).toEqual({ id: 'u2', email: 'locals@example.com' });
	});

	it('returns null when neither is set', () => {
		expect(actorFromEvent({}, undefined)).toBeNull();
		expect(actorFromEvent(undefined, undefined)).toBeNull();
	});
});

describe('audit — input shape (compile-time)', () => {
	// Just confirms the public type surface — fails to compile if AuditInput
	// drifts in an incompatible way.
	it('AuditInput accepts the documented shape', () => {
		const x: AuditInput = {
			event: { locals: { reqId: 'r' } },
			action: 'settings.update',
			targetType: 'settings',
			targetId: null,
			metadata: { ok: true }
		};
		expect(x.action).toBe('settings.update');
	});
});

describe('audit — limit constants', () => {
	it('MAX_EMAIL_LEN is 254 (RFC 5321)', () => {
		expect(MAX_EMAIL_LEN).toBe(254);
	});
});
