import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCatalogItemDeployments } from '$lib/server/services/deployment';
import { db, users } from '$lib/server/db';
import { eq } from 'drizzle-orm';

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

	const catalogItemId = params.id;
	const deployments = await getCatalogItemDeployments(catalogItemId);

	// Fetch user details for each deployment
	const deploymentsWithUsers = await Promise.all(
		deployments.map(async (deployment) => {
			const [user] = await db
				.select({ id: users.id, email: users.email, name: users.name })
				.from(users)
				.where(eq(users.id, deployment.userId));

			return {
				id: deployment.id,
				instanceUrl: deployment.instanceUrl,
				deployedAt: deployment.deployedAt,
				user: user ? { id: user.id, email: user.email, name: user.name } : null
			};
		})
	);

	return json({
		deployments: deploymentsWithUsers,
		count: deployments.length
	});
};
