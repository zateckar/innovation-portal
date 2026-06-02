import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRawDb } from '$lib/server/db';

// Cache the prepared statement to avoid re-preparing on every health check
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let healthCheckStmt: any = null;

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!healthCheckStmt) {
			healthCheckStmt = getRawDb().prepare('SELECT 1');
		}
		healthCheckStmt.run();

		const body: Record<string, unknown> = {
			status: 'healthy',
			timestamp: new Date().toISOString(),
			database: 'connected'
		};
		// Build metadata (git sha, branch, dirty flag) is sensitive — only
		// expose it to authenticated callers (admins). Unauthenticated probes
		// (k8s liveness, external uptime monitors) get just the status.
		if (locals.user?.role === 'admin') {
			const { buildInfo } = await import('$lib/build-info');
			body.build = buildInfo;
		}
		return json(body);
	} catch {
		const body: Record<string, unknown> = {
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			database: 'disconnected'
		};
		if (locals.user?.role === 'admin') {
			const { buildInfo } = await import('$lib/build-info');
			body.build = buildInfo;
		}
		return json(body, { status: 503 });
	}
};
