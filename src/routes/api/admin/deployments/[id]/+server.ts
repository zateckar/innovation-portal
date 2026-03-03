import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminUndeployById } from '$lib/server/services/deployment';

/**
 * DELETE /api/admin/deployments/[id]
 * Admin force-undeploy a specific deployment
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	if (locals.user.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	const deploymentId = params.id;

	// Check if admin has an OIDC access token
	if (!locals.user.accessToken) {
		throw error(403, 'OIDC access token required for undeployment. Please log in with corporate SSO.');
	}

	const result = await adminUndeployById(deploymentId, locals.user.accessToken);

	if (!result.success) {
		throw error(500, result.error || 'Undeployment failed');
	}

	return json({ success: true });
};
