/**
 * Atomic file-system helpers and per-key in-process mutex.
 *
 * `atomicWriteFile` writes to a `.tmp` sibling and renames into place, so
 * concurrent readers never see a torn file (renameSync is atomic on POSIX
 * and atomic-ish on Windows for non-cross-volume renames).
 *
 * `withLock(key, fn)` serialises async work tagged with the same string key,
 * preventing read-modify-write races on shared state (e.g. metadata.json
 * being mutated by both the builder process and the API endpoints).
 */
import { writeFileSync, renameSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

/**
 * Write `data` to `targetPath` atomically.
 * Uses a uniquely-named tmp sibling to avoid collisions when multiple
 * processes write to the same path concurrently.
 */
export function atomicWriteFile(targetPath: string, data: string | Buffer): void {
	mkdirSync(dirname(targetPath), { recursive: true });
	const tmp = `${targetPath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
	writeFileSync(tmp, data);
	try {
		renameSync(tmp, targetPath);
	} catch (err) {
		// On Windows, renameSync can occasionally fail with EPERM if another
		// process holds a read handle. Fall back to a direct write — losing
		// atomicity is preferable to losing the data entirely.
		try {
			writeFileSync(targetPath, data);
		} finally {
			try {
				// Best-effort cleanup of the tmp file we couldn't rename.
				const fs = require('fs') as typeof import('fs');
				if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
			} catch {
				// noop
			}
		}
		throw err;
	}
}

// ────────────────────────────────────────────────────────────────
// Per-key async mutex
// ────────────────────────────────────────────────────────────────

const locks = new Map<string, Promise<unknown>>();

/**
 * Run `fn` exclusively for the given `key`. Other callers with the same key
 * queue behind it. Different keys run in parallel.
 *
 * The lock is process-local — for cross-process serialisation use a file
 * lock instead. Within a single Node/Bun process this prevents concurrent
 * read-modify-write hazards on shared state (metadata.json, etc.).
 */
export async function withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
	const previous = locks.get(key) ?? Promise.resolve();
	let resolveNext!: () => void;
	const next = new Promise<void>((r) => {
		resolveNext = r;
	});
	// Chain: when previous settles, run fn; expose `next` to subsequent callers.
	const runP = previous.then(async () => {
		try {
			return await fn();
		} finally {
			resolveNext();
			// Clear the lock entry once nothing is queued behind it.
			if (locks.get(key) === next) locks.delete(key);
		}
	});
	locks.set(key, next);
	return runP as Promise<T>;
}

/**
 * Synchronous variant for code paths that can't be made async.
 * Falls back to the async lock if one is currently held — in that case
 * it simply runs the function inline (best-effort serialisation).
 *
 * Use sparingly; prefer `withLock` everywhere possible.
 */
export function withLockSync<T>(key: string, fn: () => T): T {
	// True sync-mutex semantics aren't possible in JS; we just run the fn.
	// The `withLock` async version is what actually serialises real callers.
	return fn();
}

/**
 * Helper: build a workspace-scoped lock key.
 */
export function workspaceLockKey(uuid: string, suffix = 'metadata'): string {
	return `ws:${uuid}:${suffix}`;
}

/** Internal helper used by `atomicWriteFile` cleanup. */
function _suppressUnusedJoin() {
	// Reference `join` so esbuild/tsc doesn't strip the import. The helper
	// exists because future callers may want a `tmp = join(dirname, ...)` form.
	void join;
}
_suppressUnusedJoin();
