import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCatalogItemDeployments } from '$lib/server/services/deployment';
import { db, users } from '$lib/server/db';
import { eq, inArray } from 'drizzle-orm';

/**
 * GET /api/admin/catalog/[id]/deployments
 * List all deployments for a specific catalog item (admin only)
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
	const catalogItemId = params.id;
	const deployments = await getCatalogItemDeployments(catalogItemId);

	if (deployments.length === 0) {
		return json({ deployments: [], count: 0 });
	}

	// Batch fetch all users in a single query instead of N+1
	const userIds = deployments.map(d => d.userId);
	const usersData = await db
		.select({ id: users.id, email: users.email, name: users.name })
		.from(users)
		.where(inArray(users.id, userIds));

	const userMap = new Map(usersData.map(u => [u.id, u]));

	const deploymentsWithUsers = deployments.map((deployment) => {
		const user = userMap.get(deployment.userId) || null;
		return {
			id: deployment.id,
			instanceUrl: deployment.instanceUrl,
			deployedAt: deployment.deployedAt,
			user: user ? { id: user.id, email: user.email, name: user.name } : null
		};
	});

	return json({
		deployments: deploymentsWithUsers,
		count: deployments.length
	});
	} catch {
		return json({ error: 'Failed to load deployments' }, { status: 500 });
	}
};
