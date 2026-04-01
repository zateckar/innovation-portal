import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { 
	deployForUser, 
	undeployForUser, 
	getUserDeployment 
} from '$lib/server/services/deployment';

/**
 * POST /api/catalog/[id]/deploy
 * Deploy a catalog item for the current user
 */
export const POST: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const catalogItemId = params.id;

	// Check if user has an OIDC access token
	if (!locals.user.accessToken) {
		throw error(403, 'OIDC access token required for deployment. Please log in with corporate SSO.');
	}

	// Check if user already has a deployment
	const existingDeployment = await getUserDeployment(locals.user.id, catalogItemId);
	if (existingDeployment) {
		return json({
			success: false,
			error: 'existing_deployment',
			message: 'You already have a deployment for this item',
			deployment: {
				id: existingDeployment.id,
				instanceUrl: existingDeployment.instanceUrl,
				deployedAt: existingDeployment.deployedAt
			}
		}, { status: 409 }); // 409 Conflict
	}

	// Execute deployment
	let result;
	try {
		result = await deployForUser(
			{
				id: locals.user.id,
				email: locals.user.email,
				name: locals.user.name
			},
			catalogItemId,
			locals.user.accessToken
		);
	} catch (err) {
		console.error('[Deploy] Deployment exception:', err);
		throw error(500, 'Deployment failed due to an internal error');
	}

	if (!result.success) {
		throw error(500, result.error || 'Deployment failed');
	}

	return json({
		success: true,
		deployment: {
			id: result.deploymentId,
			instanceUrl: result.instanceUrl
		}
	});
};

/**
 * DELETE /api/catalog/[id]/deploy
 * Undeploy/remove the current user's deployment for a catalog item
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const catalogItemId = params.id;

	// Check if user has an OIDC access token
	if (!locals.user.accessToken) {
		throw error(403, 'OIDC access token required for undeployment. Please log in with corporate SSO.');
	}

	// Check if deployment exists
	const existingDeployment = await getUserDeployment(locals.user.id, catalogItemId);
	if (!existingDeployment) {
		throw error(404, 'No deployment found');
	}

	// Execute undeployment
	let result;
	try {
		result = await undeployForUser(
			locals.user.id,
			catalogItemId,
			locals.user.accessToken
		);
	} catch (err) {
		console.error('[Undeploy] Undeployment exception:', err);
		throw error(500, 'Undeployment failed due to an internal error');
	}

	if (!result.success) {
		throw error(500, result.error || 'Undeployment failed');
	}

	return json({ success: true });
};
