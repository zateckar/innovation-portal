import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserDeployment } from '$lib/server/services/deployment';

/**
 * GET /api/catalog/[id]/deployment
 * Get the current user's deployment status for a catalog item
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const catalogItemId = params.id;
	const deployment = await getUserDeployment(locals.user.id, catalogItemId);

	if (!deployment) {
		return json({
			deployed: false
		});
	}

	return json({
		deployed: true,
		deployment: {
			id: deployment.id,
			instanceUrl: deployment.instanceUrl,
			deployedAt: deployment.deployedAt
		}
	});
};
