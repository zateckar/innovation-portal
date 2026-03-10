import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { catalogItems, innovations, userDeployments } from '$lib/server/db/schema';
import { eq, count } from 'drizzle-orm';
import { fail, redirect, error } from '@sveltejs/kit';
import { getTemplateVariables, validateManifestTemplate, validateUrlTemplate } from '$lib/server/services/deployment';

const VALID_CATEGORIES = ['ai-ml', 'devops', 'security', 'data-analytics', 'developer-tools', 'automation', 'collaboration', 'infrastructure'] as const;
const VALID_STATUSES_EDIT = ['active', 'maintenance', 'archived'] as const;
const VALID_DEPLOYMENT_TYPES = ['saas', 'self-hosted'] as const;

export const load: PageServerLoad = async ({ params }) => {
	const { id } = params;

	const item = await db
		.select()
		.from(catalogItems)
		.where(eq(catalogItems.id, id))
		.limit(1);

	if (!item.length) {
		throw error(404, 'Catalog item not found');
	}

	const catalogItem = item[0];

	// Get linked innovation info if any
	let linkedInnovation = null;
	if (catalogItem.innovationId) {
		const innovation = await db
			.select({
				id: innovations.id,
				title: innovations.title,
				slug: innovations.slug
			})
			.from(innovations)
			.where(eq(innovations.id, catalogItem.innovationId))
			.limit(1);

		if (innovation.length) {
			linkedInnovation = innovation[0];
		}
	}

	// Get deployment count for this catalog item
	const [deploymentStats] = await db
		.select({ count: count() })
		.from(userDeployments)
		.where(eq(userDeployments.catalogItemId, catalogItem.id));

	// Get available template variables
	const templateVariables = getTemplateVariables();

	return {
		catalogItem,
		linkedInnovation,
		deploymentCount: deploymentStats?.count ?? 0,
		templateVariables
	};
};

export const actions: Actions = {
	default: async ({ request, params, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden', values: null });
		}
		const formData = await request.formData();
		const { id } = params;

		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const category = formData.get('category') as string;
		const url = formData.get('url') as string;
		const howTo = formData.get('howTo') as string;
		const iconUrl = formData.get('iconUrl') as string || null;
		const screenshotUrl = formData.get('screenshotUrl') as string || null;
		const status = formData.get('status') as 'active' | 'maintenance' | 'archived';
		
		// Deployment configuration (for self-hosted items)
		const deploymentType = formData.get('deploymentType') as 'saas' | 'self-hosted';
		const deploymentApiUrl = formData.get('deploymentApiUrl') as string || null;
		const deploymentManifest = formData.get('deploymentManifest') as string || null;
		const instanceUrlTemplate = formData.get('instanceUrlTemplate') as string || null;
		const undeployManifest = formData.get('undeployManifest') as string || null;

		const formValues = { 
			name, description, category, url, howTo, iconUrl, screenshotUrl, status,
			deploymentType, deploymentApiUrl, deploymentManifest, instanceUrlTemplate, undeployManifest
		};

		// Validation
		if (!name || !description || !category || !howTo) {
			return fail(400, {
				error: 'Please fill in all required fields',
				values: formValues
			});
		}

		if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
			return fail(400, { error: 'Invalid category', values: formValues });
		}

		if (status && !(VALID_STATUSES_EDIT as readonly string[]).includes(status)) {
			return fail(400, { error: 'Invalid status', values: formValues });
		}

		if (deploymentType && !(VALID_DEPLOYMENT_TYPES as readonly string[]).includes(deploymentType)) {
			return fail(400, { error: 'Invalid deployment type', values: formValues });
		}

		// URL validation depends on deployment type
		if (deploymentType === 'saas') {
			if (!url) {
				return fail(400, {
					error: 'Please enter an access URL for SaaS deployments',
					values: formValues
				});
			}
			try {
				new URL(url);
			} catch {
				return fail(400, {
					error: 'Please enter a valid URL',
					values: formValues
				});
			}
		}

		// Self-hosted specific validations
		if (deploymentType === 'self-hosted') {
			if (!deploymentApiUrl) {
				return fail(400, {
					error: 'Deployment API URL is required for self-hosted items',
					values: formValues
				});
			}

			try {
				new URL(deploymentApiUrl);
			} catch {
				return fail(400, {
					error: 'Please enter a valid Deployment API URL',
					values: formValues
				});
			}

			if (!deploymentManifest) {
				return fail(400, {
					error: 'Deployment manifest is required for self-hosted items',
					values: formValues
				});
			}

			// Validate manifest template
			const manifestErrors = validateManifestTemplate(deploymentManifest);
			if (manifestErrors.length > 0) {
				return fail(400, {
					error: `Manifest validation errors: ${manifestErrors.join(', ')}`,
					values: formValues
				});
			}

			if (!instanceUrlTemplate) {
				return fail(400, {
					error: 'Instance URL template is required for self-hosted items',
					values: formValues
				});
			}

			// Validate URL template
			const urlErrors = validateUrlTemplate(instanceUrlTemplate);
			if (urlErrors.length > 0) {
				return fail(400, {
					error: `URL template validation errors: ${urlErrors.join(', ')}`,
					values: formValues
				});
			}

			// Validate undeploy manifest if provided
			if (undeployManifest) {
				const undeployErrors = validateManifestTemplate(undeployManifest);
				if (undeployErrors.length > 0) {
					return fail(400, {
						error: `Undeploy manifest validation errors: ${undeployErrors.join(', ')}`,
						values: formValues
					});
				}
			}
		}

		try {
			await db
				.update(catalogItems)
				.set({
					name,
					description,
					category: category as (typeof VALID_CATEGORIES)[number],
					url: deploymentType === 'self-hosted' ? '#self-hosted' : url,
					howTo,
					iconUrl,
					screenshotUrl,
					status,
					deploymentType,
					deploymentApiUrl: deploymentType === 'self-hosted' ? deploymentApiUrl : null,
					deploymentManifest: deploymentType === 'self-hosted' ? deploymentManifest : null,
					instanceUrlTemplate: deploymentType === 'self-hosted' ? instanceUrlTemplate : null,
					undeployManifest: deploymentType === 'self-hosted' ? undeployManifest : null,
					updatedAt: new Date(),
					archivedAt: status === 'archived' ? new Date() : null
				})
				.where(eq(catalogItems.id, id));
		} catch (error) {
			console.error('Error updating catalog item:', error);
			return fail(500, {
				error: 'Failed to update catalog item',
				values: formValues
			});
		}

		throw redirect(303, '/admin/catalog');
	}
};
