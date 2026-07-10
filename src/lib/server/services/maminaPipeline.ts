/**
 * Mamina External Build Pipeline
 *
 * A thin client + workspace sync layer for the "Mamina" external autonomous
 * build API (https://www.mamina.net/api/v1). It is offered as an alternative
 * to the app's internal `builder.ts` subprocess: instead of spawning a local
 * process, we POST a run to Mamina and poll it for progress.
 *
 * Design goals (mirrors the internal builder so the rest of the app is reused):
 *   - State lives in the SAME `workspaces/<uuid>/metadata.json`, tagged
 *     `pipeline: 'external'`, so the development page, polling, status badges
 *     and cost display all work unchanged.
 *   - All metadata writes go through the atomic, mutex-guarded metadata store.
 *   - `syncRunToWorkspace` is safe to call from many places at once (the 5s
 *     page poll AND the background watchdog): per-uuid in-flight coalescing +
 *     a short throttle keep API traffic bounded, and event dedup happens inside
 *     the atomic lock via a persisted `lastEventId` cursor.
 *
 * Config is env-only (no DB/admin surface). The feature is enabled iff
 * MAMINA_API_KEY is set.
 */
import { env } from '$env/dynamic/private';
import {
	updateMetadataAtomic,
	readMetadataSafeExt,
	type BuildLogEntry
} from '../../../../scripts/metadata-store.ts';

const DEFAULT_BASE_URL = 'https://www.mamina.net/api/v1';
const REQUEST_TIMEOUT_MS = 8000;
/** Skip a network sync if the workspace was refreshed more recently than this. */
const SYNC_THROTTLE_MS = 3000;
/** Give up on a run that has failed to sync (non-auth errors) for longer than this. */
const SYNC_FAILURE_GIVEUP_MS = 10 * 60 * 1000;

/** HTTP error from the Mamina API, carrying the response status for classification. */
class MaminaHttpError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}

/** Mamina terminal run statuses (from external-api.md + test_mamina_api.py). */
const TERMINAL_STATUSES = new Set(['completed', 'completed_empty', 'failed', 'cancelled']);

export interface MaminaRun {
	id: string;
	title?: string;
	status: string;
	total_cost_usd?: string | number | null;
	deploy_url?: string | null;
	pr_url?: string | null;
	error_reason?: string | null;
	[key: string]: unknown;
}

interface MaminaEvent {
	id: number;
	type: string;
	payload?: Record<string, unknown>;
	ts?: string;
}

// ── Config ──────────────────────────────────────────────────────────────────

function apiKey(): string | null {
	return env.MAMINA_API_KEY?.trim() || null;
}

function baseUrl(): string {
	return (env.MAMINA_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function maxBudget(): number {
	const raw = Number(env.MAMINA_MAX_BUDGET);
	return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

function model(): string | null {
	return env.MAMINA_MODEL?.trim() || null;
}

/** The feature is available iff an API key is configured. */
export function isConfigured(): boolean {
	return apiKey() !== null;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
	const key = apiKey();
	if (!key) throw new Error('Mamina API key is not configured');
	return { Authorization: `Bearer ${key}`, ...extra };
}

async function request(
	method: string,
	path: string,
	opts: { body?: unknown; headers?: Record<string, string> } = {}
): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const res = await fetch(`${baseUrl()}${path}`, {
			method,
			headers: authHeaders({
				...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
				...opts.headers
			}),
			body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
			signal: controller.signal
		});
		if (!res.ok) {
			const text = await res.text().catch(() => '');
			throw new MaminaHttpError(
				`Mamina ${method} ${path} failed: ${res.status} ${text.slice(0, 500)}`,
				res.status
			);
		}
		if (res.status === 204) return null;
		return await res.json().catch(() => null);
	} finally {
		clearTimeout(timer);
	}
}

// ── API surface ──────────────────────────────────────────────────────────────

/**
 * Create a new Mamina run for a specification. No `repo_url` is sent — the
 * Mamina server uses its own default repo. `uuid` doubles as the
 * Idempotency-Key so a retried / raced POST never spawns a duplicate run.
 */
export async function createRun(spec: string, title: string, uuid: string): Promise<MaminaRun> {
	const task_text =
		'Build the following application from scratch based on this spec.\n\n' +
		spec +
		'\n\nCreate a complete, production-ready implementation.';

	const body: Record<string, unknown> = {
		task_text,
		run_result_type: 'DEPLOY',
		pr_title: title.slice(0, 200),
		labels: { source: 'ideation-portal' },
		max_budget_usd: maxBudget()
	};
	const m = model();
	if (m) body.model = m;

	const run = (await request('POST', '/external/runs', {
		body,
		headers: { 'Idempotency-Key': uuid }
	})) as MaminaRun;
	return run;
}

export async function getRun(runId: string): Promise<MaminaRun> {
	return (await request('GET', `/runs/${runId}`)) as MaminaRun;
}

/** Fetch events newer than `since`, tolerating both `[...]` and `{key:[...]}` bodies. */
export async function getEvents(runId: string, since: number): Promise<MaminaEvent[]> {
	const body = await request('GET', `/runs/${runId}/events?since=${since}`);
	return normalizeEvents(body);
}

export async function cancelRun(runId: string): Promise<MaminaRun> {
	return (await request('POST', `/runs/${runId}/cancel`)) as MaminaRun;
}

function normalizeEvents(body: unknown): MaminaEvent[] {
	let list: unknown[] = [];
	if (Array.isArray(body)) {
		list = body;
	} else if (body && typeof body === 'object') {
		for (const v of Object.values(body as Record<string, unknown>)) {
			if (Array.isArray(v)) {
				list = v;
				break;
			}
		}
	}
	return list.filter(
		(e): e is MaminaEvent =>
			!!e && typeof e === 'object' && typeof (e as MaminaEvent).id === 'number'
	);
}

// ── Mapping helpers ──────────────────────────────────────────────────────────

/** Map a Mamina run to the internal status vocabulary used by the dev page. */
function mapStatus(run: MaminaRun): { status: string; error?: string } {
	const s = (run.status || '').toLowerCase();
	if (!TERMINAL_STATUSES.has(s)) {
		// queued | running | anything non-terminal → an active build phase.
		return { status: 'building' };
	}
	if (s === 'completed' || s === 'completed_empty') {
		if (run.deploy_url) return { status: 'deployed' };
		return { status: 'error', error: 'Run completed but produced no deployable app.' };
	}
	// failed | cancelled
	return { status: 'error', error: run.error_reason || `Run ${s}.` };
}

function str(v: unknown): string {
	return typeof v === 'string' ? v : v == null ? '' : String(v);
}

/**
 * Turn a Mamina event into a user-facing feed row (exposing only task name,
 * message and time). Returns null for events that carry no narrative row
 * (e.g. pure cost ticks, which update the price separately).
 */
function eventToLogEntry(ev: MaminaEvent): BuildLogEntry | null {
	const p = ev.payload ?? {};
	const ts = ev.ts || new Date().toISOString();
	const row = (phase: string, message: string, status: BuildLogEntry['status'] = 'info') => ({
		timestamp: ts,
		phase: phase || 'Run',
		message,
		status
	});

	switch (ev.type) {
		case 'status_update':
		case 'agent_progress': {
			const progress = p.progress;
			const suffix = typeof progress === 'number' ? ` (${progress}%)` : '';
			return row(str(p.agent) || 'Agent', str(p.message) + suffix);
		}
		case 'agent_spawned':
			return row(str(p.role) || 'Agent', `Started: ${str(p.task_text).slice(0, 200)}`);
		case 'agent_done':
			return row(
				str(p.agent) || 'Agent',
				str(p.summary) || 'Done',
				p.success === false ? 'error' : 'completed'
			);
		case 'run_started':
			return row('Run', 'Run started', 'info');
		case 'run_created_via_api_key':
			return row('Run', 'Run created', 'info');
		case 'run_completed':
			return row('Run', 'Run completed', 'completed');
		case 'run_failed':
			return row('Run', `Run failed${p.reason ? `: ${str(p.reason)}` : ''}`, 'error');
		case 'run_cancelled':
			return row('Run', 'Run cancelled', 'error');
		// Cost ticks / url-set / unknown types carry no narrative row.
		default:
			return null;
	}
}

/** Extract the latest total cost (USD) from a run + its new events. */
function latestCost(run: MaminaRun, events: MaminaEvent[]): number | null {
	let cost: number | null = null;
	const parse = (v: unknown): number | null => {
		const n = parseFloat(str(v));
		return Number.isFinite(n) ? n : null;
	};
	const runCost = parse(run.total_cost_usd);
	if (runCost !== null) cost = runCost;
	for (const ev of events) {
		if (ev.type === 'run_cost_updated') {
			const c = parse(ev.payload?.total_cost_usd);
			if (c !== null) cost = c;
		}
	}
	return cost;
}

/** Extract a deploy_url set by any event in the batch. */
function deployUrlFromEvents(events: MaminaEvent[]): string | null {
	for (const ev of events) {
		if (ev.type === 'deploy_url_set') {
			const url = str(ev.payload?.deploy_url);
			if (url) return url;
		}
	}
	return null;
}

// ── Workspace sync ───────────────────────────────────────────────────────────

const inFlight = new Map<string, Promise<void>>();

/**
 * Pull the latest state of an external run into its workspace metadata.
 *
 * Safe to call concurrently: a per-uuid in-flight promise coalesces overlapping
 * calls, a short throttle avoids hammering the API on the 5s page poll, and
 * event dedup happens inside the atomic metadata lock via `lastEventId`.
 * Never throws — failures leave the last-known metadata intact.
 */
export function syncRunToWorkspace(uuid: string): Promise<void> {
	const existing = inFlight.get(uuid);
	if (existing) return existing;
	const p = doSync(uuid).finally(() => inFlight.delete(uuid));
	inFlight.set(uuid, p);
	return p;
}

async function doSync(uuid: string): Promise<void> {
	try {
		const meta = readMetadataSafeExt(uuid);
		if (!meta || meta.pipeline !== 'external') return;
		// Already finished (deployed/error/cancelled) — never re-sync, so a
		// terminal write (e.g. from /cancel) can't be raced or clobbered by a
		// stale poll re-fetching the remote run.
		if (isTerminalStatus(meta.status)) return;
		const runId = str(meta.maminaRunId);
		if (!runId) return;

		// Throttle: skip if we synced very recently (many tabs polling at once).
		const lastUpdated = meta.lastUpdated ? new Date(meta.lastUpdated).getTime() : 0;
		if (lastUpdated && Date.now() - lastUpdated < SYNC_THROTTLE_MS) return;

		const since = typeof meta.lastEventId === 'number' ? meta.lastEventId : 0;
		const [run, events] = await Promise.all([getRun(runId), getEvents(runId, since)]);

		const cost = latestCost(run, events);
		const deployUrl = run.deploy_url || deployUrlFromEvents(events) || null;
		const prUrl = run.pr_url || null;
		const mapped = mapStatus({ ...run, deploy_url: deployUrl });

		await updateMetadataAtomic(uuid, (m) => {
			// A terminal write (e.g. user cancel) may have landed while this
			// sync's network call was in flight — don't undo it.
			if (isTerminalStatus(m.status)) return m;

			// Append only genuinely-new events (dedup inside the lock).
			const cursor = typeof m.lastEventId === 'number' ? m.lastEventId : 0;
			let maxId = cursor;
			if (!Array.isArray(m.buildLog)) m.buildLog = [];
			let lastPhase: string | null = null;
			for (const ev of events) {
				if (ev.id <= cursor) continue;
				if (ev.id > maxId) maxId = ev.id;
				const entry = eventToLogEntry(ev);
				if (entry) {
					m.buildLog.push(entry);
					lastPhase = entry.phase;
				}
			}
			m.lastEventId = maxId;
			// Surface the latest task name in the header's active-build line.
			if (lastPhase && mapped.status === 'building') m.currentPhase = lastPhase;
			m.maminaStatus = run.status;
			m.status = mapped.status;
			if (mapped.status === 'error') m.error = mapped.error;
			else if (m.error) m.error = undefined;
			if (cost !== null) m.externalCostUsd = cost;
			if (deployUrl) m.deployUrl = deployUrl;
			if (prUrl) m.prUrl = prUrl;
			// This sync succeeded — clear any prior-failure tracking.
			if (m.syncFailingSince) m.syncFailingSince = undefined;
			return m;
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.warn(`[mamina] sync failed for ${uuid}:`, message);

		if (err instanceof MaminaHttpError && (err.status === 401 || err.status === 403)) {
			// Unrecoverable without operator action — stop hammering the API and
			// surface it instead of hanging in 'building' forever.
			await updateMetadataAtomic(uuid, (m) => {
				if (isTerminalStatus(m.status)) return m;
				m.status = 'error';
				m.error = `Mamina API authentication failed (${err.status}) — check MAMINA_API_KEY.`;
				return m;
			}).catch(() => {});
			return;
		}

		// Transient-looking failure (network error, timeout, 5xx) — tolerate it,
		// but don't let the run hang forever if it never recovers.
		await updateMetadataAtomic(uuid, (m) => {
			if (isTerminalStatus(m.status)) return m;
			const failingSince = m.syncFailingSince ? new Date(String(m.syncFailingSince)).getTime() : 0;
			if (!failingSince) {
				m.syncFailingSince = new Date().toISOString();
				return m;
			}
			if (Date.now() - failingSince > SYNC_FAILURE_GIVEUP_MS) {
				m.status = 'error';
				m.error = `Lost contact with Mamina API for over ${Math.round(SYNC_FAILURE_GIVEUP_MS / 60_000)} minutes: ${message}`;
			}
			return m;
		}).catch(() => {});
	}
}

/** True when a mapped metadata status is terminal (no further sync needed). */
export function isTerminalStatus(status: string | undefined): boolean {
	return status === 'deployed' || status === 'error';
}
