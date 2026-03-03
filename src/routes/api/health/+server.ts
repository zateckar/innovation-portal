import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, users } from '$lib/server/db';
import { count } from 'drizzle-orm';

export const GET: RequestHandler = async () => {
	try {
		// Check database connectivity
		const [result] = await db.select({ count: count() }).from(users);
		
		return json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			database: 'connected',
			userCount: result.count
		});
	} catch (error) {
		return json({
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			database: 'disconnected',
			error: error instanceof Error ? error.message : 'Unknown error'
		}, { status: 503 });
	}
};
