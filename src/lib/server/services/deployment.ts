import { db, catalogItems, userDeployments, type CatalogItem, type UserDeployment, type User } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
/**
 * Template variables available for K8s manifest and URL templates
 */
export interface DeploymentContext {
	username: string;
	user_id: string;
	email: string;
	timestamp: number;
	random_suffix: string;
	catalog_item_name: string;
	catalog_item_id: string;
}

/**
 * Result of a deployment operation
 */
export interface DeploymentResult {
	success: boolean;
	instanceUrl?: string;
	error?: string;
	deploymentId?: string;
}

/**
 * Generate a random alphanumeric suffix for unique resource names
 */
function generateRandomSuffix(length: number = 8): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Sanitize username for use in Kubernetes resource names
 * K8s names must be lowercase, alphanumeric, and can contain hyphens
 */
function sanitizeForK8s(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/--+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 63); // K8s name limit
}

/**
 * Create a deployment context with all available template variables
 */
export function createDeploymentContext(
	user: { id: string; email: string; name: string },
	catalogItem: { id: string; slug: string }
): DeploymentContext {
	// Extract username from email (before @) or use sanitized name
	const username = sanitizeForK8s(
		user.email.includes('@') 
			? user.email.split('@')[0] 
			: user.name
	);

	return {
		username,
		user_id: user.id,
		email: user.email,
		timestamp: Math.floor(Date.now() / 1000),
		random_suffix: generateRandomSuffix(),
		catalog_item_name: catalogItem.slug,
		catalog_item_id: catalogItem.id
	};
}

/**
 * Resolve template variables in a string
 * Supports {{variable_name}} syntax
 */
export function resolveTemplate(template: string, context: DeploymentContext): string {
	return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
		const value = context[varName as keyof DeploymentContext];
		return value !== undefined ? String(value) : match;
	});
}

/**
 * Validate that a YAML manifest template is valid
 * Returns list of validation errors (empty if valid)
 */
export function validateManifestTemplate(template: string): string[] {
	const errors: string[] = [];

	if (!template || template.trim().length === 0) {
		errors.push('Manifest template cannot be empty');
		return errors;
	}

	// Check for basic YAML structure (should have apiVersion and kind)
	if (!template.includes('apiVersion:')) {
		errors.push('Manifest should contain apiVersion');
	}
	if (!template.includes('kind:')) {
		errors.push('Manifest should contain kind');
	}

	// Check for unrecognized template variables
	const validVars = ['username', 'user_id', 'email', 'timestamp', 'random_suffix', 'catalog_item_name', 'catalog_item_id'];
	const varMatches = template.matchAll(/\{\{(\w+)\}\}/g);
	for (const match of varMatches) {
		if (!validVars.includes(match[1])) {
			errors.push(`Unknown template variable: {{${match[1]}}}`);
		}
	}

	return errors;
}

/**
 * Validate URL template
 */
export function validateUrlTemplate(template: string): string[] {
	const errors: string[] = [];

	if (!template || template.trim().length === 0) {
		errors.push('URL template cannot be empty');
		return errors;
	}

	// Should start with http:// or https://
	const resolvedSample = template.replace(/\{\{\w+\}\}/g, 'test');
	try {
		new URL(resolvedSample);
	} catch {
		errors.push('URL template must be a valid URL format');
	}

	// Check for unrecognized template variables
	const validVars = ['username', 'user_id', 'email', 'timestamp', 'random_suffix', 'catalog_item_name', 'catalog_item_id'];
	const varMatches = template.matchAll(/\{\{(\w+)\}\}/g);
	for (const match of varMatches) {
		if (!validVars.includes(match[1])) {
			errors.push(`Unknown template variable: {{${match[1]}}}`);
		}
	}

	return errors;
}

/**
 * Get a user's deployment for a specific catalog item
 */
export async function getUserDeployment(
	userId: string,
	catalogItemId: string
): Promise<UserDeployment | null> {
	const [deployment] = await db
		.select()
		.from(userDeployments)
		.where(
			and(
				eq(userDeployments.userId, userId),
				eq(userDeployments.catalogItemId, catalogItemId)
			)
		);
	return deployment || null;
}

/**
 * Get all deployments for a user
 */
export async function getUserDeployments(userId: string): Promise<(UserDeployment & { catalogItem: CatalogItem })[]> {
	const deployments = await db
		.select({
			deployment: userDeployments,
			catalogItem: catalogItems
		})
		.from(userDeployments)
		.innerJoin(catalogItems, eq(userDeployments.catalogItemId, catalogItems.id))
		.where(eq(userDeployments.userId, userId));

	return deployments.map(d => ({
		...d.deployment,
		catalogItem: d.catalogItem
	}));
}

/**
 * Get all deployments for a catalog item (admin)
 */
export async function getCatalogItemDeployments(catalogItemId: string): Promise<UserDeployment[]> {
	return db
		.select()
		.from(userDeployments)
		.where(eq(userDeployments.catalogItemId, catalogItemId));
}

/**
 * Execute a deployment for a user
 */
export async function deployForUser(
	user: { id: string; email: string; name: string },
	catalogItemId: string,
	accessToken: string
): Promise<DeploymentResult> {
	// Get the catalog item
	const [catalogItem] = await db
		.select()
		.from(catalogItems)
		.where(eq(catalogItems.id, catalogItemId));

	if (!catalogItem) {
		return { success: false, error: 'Catalog item not found' };
	}

	if (catalogItem.deploymentType !== 'self-hosted') {
		return { success: false, error: 'This catalog item is not deployable (SaaS type)' };
	}

	if (!catalogItem.deploymentManifest || !catalogItem.deploymentApiUrl || !catalogItem.instanceUrlTemplate) {
		return { success: false, error: 'Deployment configuration is incomplete' };
	}

	// Check for existing deployment
	const existingDeployment = await getUserDeployment(user.id, catalogItemId);
	if (existingDeployment) {
		return { 
			success: false, 
			error: 'User already has a deployment for this item',
			instanceUrl: existingDeployment.instanceUrl,
			deploymentId: existingDeployment.id
		};
	}

	// Create deployment context
	const context = createDeploymentContext(user, catalogItem);

	// Resolve templates
	const resolvedManifest = resolveTemplate(catalogItem.deploymentManifest, context);
	const resolvedUrl = resolveTemplate(catalogItem.instanceUrlTemplate, context);

	// Send manifest to deployment API
	try {
		const response = await fetch(catalogItem.deploymentApiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/yaml',
				'Authorization': `Bearer ${accessToken}`
			},
			body: resolvedManifest
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('Deployment API error:', response.status, errorText);
			return { 
				success: false, 
				error: `Deployment failed: ${response.status} ${response.statusText}` 
			};
		}

		// Create deployment record
		const deploymentId = crypto.randomUUID();
		await db.insert(userDeployments).values({
			id: deploymentId,
			userId: user.id,
			catalogItemId: catalogItemId,
			instanceUrl: resolvedUrl,
			deployedAt: new Date(),
			deploymentVariables: JSON.stringify(context)
		});

		return {
			success: true,
			instanceUrl: resolvedUrl,
			deploymentId
		};
	} catch (error) {
		console.error('Deployment error:', error);
		return { 
			success: false, 
			error: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
		};
	}
}

/**
 * Undeploy/remove a user's deployment
 */
export async function undeployForUser(
	userId: string,
	catalogItemId: string,
	accessToken: string
): Promise<DeploymentResult> {
	// Get the deployment
	const deployment = await getUserDeployment(userId, catalogItemId);
	if (!deployment) {
		return { success: false, error: 'No deployment found' };
	}

	// Get the catalog item
	const [catalogItem] = await db
		.select()
		.from(catalogItems)
		.where(eq(catalogItems.id, catalogItemId));

	if (!catalogItem) {
		// Catalog item was deleted, just remove the deployment record
		await db.delete(userDeployments).where(eq(userDeployments.id, deployment.id));
		return { success: true };
	}

	// If there's an undeploy manifest, send it to the API
	if (catalogItem.undeployManifest && catalogItem.deploymentApiUrl) {
		try {
			// Parse stored deployment variables to use for undeploy
			const storedContext = deployment.deploymentVariables 
				? JSON.parse(deployment.deploymentVariables) as DeploymentContext
				: null;

			if (storedContext) {
				const resolvedUndeployManifest = resolveTemplate(catalogItem.undeployManifest, storedContext);

				const response = await fetch(catalogItem.deploymentApiUrl, {
					method: 'DELETE',
					headers: {
						'Content-Type': 'application/yaml',
						'Authorization': `Bearer ${accessToken}`
					},
					body: resolvedUndeployManifest
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error('Undeploy API error:', response.status, errorText);
					// Continue to delete the record anyway - the deployment might already be gone
				}
			}
		} catch (error) {
			console.error('Undeploy error:', error);
			// Continue to delete the record anyway
		}
	}

	// Delete the deployment record
	await db.delete(userDeployments).where(eq(userDeployments.id, deployment.id));

	return { success: true };
}

/**
 * Admin: Force undeploy a specific deployment
 */
export async function adminUndeployById(
	deploymentId: string,
	accessToken: string
): Promise<DeploymentResult> {
	// Get the deployment
	const [deployment] = await db
		.select()
		.from(userDeployments)
		.where(eq(userDeployments.id, deploymentId));

	if (!deployment) {
		return { success: false, error: 'Deployment not found' };
	}

	return undeployForUser(deployment.userId, deployment.catalogItemId, accessToken);
}

/**
 * Get available template variables with descriptions
 */
export function getTemplateVariables(): { name: string; description: string; example: string }[] {
	return [
		{ name: 'username', description: 'Sanitized username from email (K8s compatible)', example: 'john-doe' },
		{ name: 'user_id', description: 'Unique user ID', example: 'usr_abc123xyz' },
		{ name: 'email', description: 'User email address', example: 'john.doe@company.com' },
		{ name: 'timestamp', description: 'Unix timestamp of deployment', example: '1709510400' },
		{ name: 'random_suffix', description: 'Random 8-char alphanumeric string', example: 'a7b3c9d2' },
		{ name: 'catalog_item_name', description: 'Catalog item slug', example: 'code-assistant' },
		{ name: 'catalog_item_id', description: 'Catalog item ID', example: 'cat_xyz789' }
	];
}
