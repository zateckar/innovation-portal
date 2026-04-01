import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { catalogItems, innovations, votes, userDeployments } from '$lib/server/db/schema';
import { eq, count, and } from 'drizzle-orm';
import { error, redirect } from '@sveltejs/kit';
import type { CatalogItemDetail, InnovationCategory, CatalogItemStatus, DepartmentCategory } from '$lib/types';
import { getUserDeployment } from '$lib/server/services/deployment';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const { slug } = params;
	const userId = locals.user.id;

	try {
	const item = await db
		.select()
		.from(catalogItems)
		.where(eq(catalogItems.slug, slug))
		.limit(1);

	if (!item.length) {
		throw error(404, 'Catalog item not found');
	}

	const catalogItem = item[0];

	// Get related innovation info if linked
	let relatedInnovation: CatalogItemDetail['relatedInnovation'] = null;
	if (catalogItem.innovationId) {
		const innovationData = await db
			.select({
				slug: innovations.slug,
				title: innovations.title
			})
			.from(innovations)
			.where(eq(innovations.id, catalogItem.innovationId))
			.limit(1);

		if (innovationData.length) {
			// Get vote count
			const voteData = await db
				.select({ count: count() })
				.from(votes)
				.where(eq(votes.innovationId, catalogItem.innovationId));

			relatedInnovation = {
				slug: innovationData[0].slug,
				title: innovationData[0].title,
				voteCount: voteData[0]?.count || 0
			};
		}
	}

	const catalogItemDetail: CatalogItemDetail = {
		id: catalogItem.id,
		slug: catalogItem.slug,
		name: catalogItem.name,
		description: catalogItem.description,
		category: catalogItem.category as InnovationCategory,
		department: (catalogItem.department ?? null) as DepartmentCategory | null,
		url: catalogItem.url,
		howTo: catalogItem.howTo,
		iconUrl: catalogItem.iconUrl,
		screenshotUrl: catalogItem.screenshotUrl,
		status: catalogItem.status as CatalogItemStatus,
		innovationId: catalogItem.innovationId,
		createdAt: catalogItem.createdAt,
		updatedAt: catalogItem.updatedAt,
		archivedAt: catalogItem.archivedAt,
		relatedInnovation
	};

	// Get deployment type and user's deployment if self-hosted
	const deploymentType = catalogItem.deploymentType as 'saas' | 'self-hosted';
	let userDeployment: { id: string; instanceUrl: string; deployedAt: Date } | null = null;

	if (deploymentType === 'self-hosted' && userId) {
		const deployment = await getUserDeployment(userId, catalogItem.id);
		if (deployment) {
			userDeployment = {
				id: deployment.id,
				instanceUrl: deployment.instanceUrl,
				deployedAt: deployment.deployedAt
			};
		}
	}

	// Check if user has OIDC access token (needed for deployment)
	const hasAccessToken = !!locals.user.accessToken;

	return {
		catalogItem: catalogItemDetail,
		deploymentType,
		userDeployment,
		hasAccessToken,
		isLoggedIn: !!userId
	};
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(500, 'Failed to load catalog item');
	}
};
