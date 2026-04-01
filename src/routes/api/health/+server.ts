import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRawDb } from '$lib/server/db';

// biome-ignore lint/suspicious/noExplicitAny: better-sqlite3 Statement type is not exported
let healthCheckStmt: any = null;

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	try {
		// Lazily prepare and cache the statement (avoids module-level DB init during build)
		if (!healthCheckStmt) {
			healthCheckStmt = getRawDb().prepare('SELECT 1');
		}
		healthCheckStmt.run();

		return json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			database: 'connected'
		});
	} catch {
		return json({
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			database: 'disconnected'
		}, { status: 503 });
	}
};
