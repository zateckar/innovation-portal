import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deployForUser,
	undeployForUser,
	getUserDeployment
} from '$lib/server/services/deployment';
import { userFromBearer, extractBearerToken } from '$lib/server/bearerAuth';
import { auditAsync } from '$lib/server/audit';

/**
 * Authenticate the request — accept either a session cookie (existing flow)
 * or a bearer token (REVIEW.md §3.6). Bearer auth lets long-running
 * automations (CI, an AI agent) drive deploys without a cookie jar.
 *
 * Bearer takes precedence: if the caller sends `Authorization: Bearer …`,
 * we trust that over any session cookie that may also be present. This
 * matches the intent of an external caller who has gone to the trouble of
 * minting a token.
 */
async function authenticate(event: Parameters<RequestHandler>[0]): Promise<{
	user: NonNullable<App.Locals['user']>;
	authMethod: 'session' | 'bearer';
	bearerToken: string | null;
}> {
	const bearerUser = await userFromBearer(event.request);
	if (bearerUser) {
		event.locals.user = bearerUser;
		const token = extractBearerToken(event.request);
		return { user: bearerUser, authMethod: 'bearer', bearerToken: token };
	}
	if (event.locals.user) {
		return { user: event.locals.user, authMethod: 'session', bearerToken: null };
	}
	throw error(401, 'Authentication required');
}

/**
 * POST /api/catalog/[id]/deploy
 * Deploy a catalog item for the current user
 */
export const POST: RequestHandler = async (event) => {
	const { params, locals } = event;
	const { user, authMethod, bearerToken } = await authenticate(event);
	if (!user) throw error(401, 'Authentication required');

	const catalogItemId = params.id;

	// Check if user already has a deployment
	const existingDeployment = await getUserDeployment(user.id, catalogItemId);
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
		}, { status: 409 });
	}

	// For downstream calls we need a credential. Two paths:
	//   1. Cookie auth — reuse the OIDC access token captured at login.
	//   2. Bearer auth — the OIDC token may have expired (this is the bug
	//      REVIEW.md §3.6 calls out). Forward the bearer token itself; the
	//      downstream service trusts whatever the portal trusts.
	const downstreamToken =
		authMethod === 'bearer' && bearerToken
			? bearerToken
			: locals.user?.accessToken;

	if (!downstreamToken) {
		throw error(403, 'OIDC access token required for deployment. Please log in with corporate SSO.');
	}

	// Execute deployment
	let result;
	try {
		result = await deployForUser(
			{
				id: user.id,
				email: user.email,
				name: user.name
			},
			catalogItemId,
			downstreamToken
		);
	} catch (err) {
		console.error('[Deploy] Deployment exception:', err);
		throw error(500, 'Deployment failed due to an internal error');
	}

	auditAsync({
		event,
		action: 'deployment.create',
		targetType: 'catalog_item',
		targetId: catalogItemId,
		metadata: { authMethod }
	});

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
export const DELETE: RequestHandler = async (event) => {
	const { params, locals } = event;
	const { user, authMethod, bearerToken } = await authenticate(event);
	if (!user) throw error(401, 'Authentication required');

	const catalogItemId = params.id;

	// Check if deployment exists
	const existingDeployment = await getUserDeployment(user.id, catalogItemId);
	if (!existingDeployment) {
		throw error(404, 'No deployment found');
	}

	const downstreamToken =
		authMethod === 'bearer' && bearerToken
			? bearerToken
			: locals.user?.accessToken;
	if (!downstreamToken) {
		throw error(403, 'OIDC access token required for undeployment. Please log in with corporate SSO.');
	}

	// Execute undeployment
	let result;
	try {
		result = await undeployForUser(
			user.id,
			catalogItemId,
			downstreamToken
		);
	} catch (err) {
		console.error('[Undeploy] Undeployment exception:', err);
		throw error(500, 'Undeployment failed due to an internal error');
	}

	auditAsync({
		event,
		action: 'deployment.delete',
		targetType: 'catalog_item',
		targetId: catalogItemId,
		metadata: { authMethod }
	});

	if (!result.success) {
		throw error(500, result.error || 'Undeployment failed');
	}

	return json({ success: true });
};
