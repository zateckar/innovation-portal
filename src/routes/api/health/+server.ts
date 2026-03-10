import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	try {
		// Verify database connectivity with a minimal query
		await db.run(sql`SELECT 1`);

		return json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			database: 'connected'
		});
	} catch {
		// Do not expose internal error details to the client
		return json({
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			database: 'disconnected'
		}, { status: 503 });
	}
};
