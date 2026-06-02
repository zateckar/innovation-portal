/**
 * Retry with exponential backoff + jitter.
 *
 * Used for AI calls (Gemini) that occasionally return 429/503. Without this,
 * a single transient failure aborts the entire batch — see the F-016 finding
 * in REVIEW.md.
 *
 * Honours `Retry-After` (seconds) on 429/503 if the error exposes it via
 * `err.headers.get('retry-after')` (fetch Response) or a numeric `retryAfter`
 * property. Falls back to exponential backoff otherwise.
 */
export interface RetryOptions {
	tries?: number;
	baseMs?: number;
	factor?: number;
	maxMs?: number;
	signal?: AbortSignal;
}

const RETRY_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export function isRetryableError(err: unknown): boolean {
	if (!err) return false;
	const anyErr = err as { status?: number; code?: number; message?: string };
	if (typeof anyErr.status === 'number' && RETRY_STATUS.has(anyErr.status)) return true;
	if (typeof anyErr.code === 'number' && RETRY_STATUS.has(anyErr.code)) return true;
	const msg = String(anyErr.message ?? '').toLowerCase();
	if (msg.includes('rate limit') || msg.includes('timeout') || msg.includes('econnreset') || msg.includes('etimedout')) {
		return true;
	}
	return false;
}

function readRetryAfter(err: unknown): number | null {
	const anyErr = err as { headers?: { get?: (k: string) => string | null }; retryAfter?: number };
	if (typeof anyErr.retryAfter === 'number' && anyErr.retryAfter >= 0) return anyErr.retryAfter;
	try {
		const v = anyErr.headers?.get?.('retry-after');
		if (v) {
			const asNum = Number(v);
			if (Number.isFinite(asNum)) return asNum;
			const asDate = Date.parse(v);
			if (Number.isFinite(asDate)) return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
		}
	} catch {
		// ignore
	}
	return null;
}

function jitter(ms: number): number {
	return Math.floor(ms * (0.5 + Math.random() * 0.5));
}

export async function withRetries<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
	const tries = opts.tries ?? 3;
	const baseMs = opts.baseMs ?? 1000;
	const factor = opts.factor ?? 2;
	const maxMs = opts.maxMs ?? 10_000;

	let lastErr: unknown;
	for (let attempt = 0; attempt < tries; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			if (attempt === tries - 1) break;
			if (!isRetryableError(err)) break;
			if (opts.signal?.aborted) break;

			const ra = readRetryAfter(err);
			const backoff = ra !== null ? ra * 1000 : jitter(Math.min(maxMs, baseMs * Math.pow(factor, attempt)));
			await new Promise((r) => setTimeout(r, backoff));
		}
	}
	throw lastErr;
}
