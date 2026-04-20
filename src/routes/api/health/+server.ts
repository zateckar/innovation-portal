import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRawDb } from '$lib/server/db';
import { buildInfo } from '$lib/build-info';

// Cache the prepared statement to avoid re-preparing on every health check
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let healthCheckStmt: any = null;

export const GET: RequestHandler = async () => {
	try {
		if (!healthCheckStmt) {
			healthCheckStmt = getRawDb().prepare('SELECT 1');
		}
		healthCheckStmt.run();

		return json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			database: 'connected',
			// Build metadata so external monitoring (and `curl /api/health`)
			// can verify which commit is deployed without reaching the UI.
			build: buildInfo
		});
	} catch {
		return json(
			{
				status: 'unhealthy',
				timestamp: new Date().toISOString(),
				database: 'disconnected',
				build: buildInfo
			},
			{ status: 503 }
		);
	}
};
