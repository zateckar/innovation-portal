import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { catalogItems } from '$lib/server/db/schema';
import { eq, and, like, desc, or } from 'drizzle-orm';
import type { CatalogItemSummary, InnovationCategory } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const category = url.searchParams.get('category') as InnovationCategory | null;
	const search = url.searchParams.get('q');
	const showArchived = url.searchParams.get('archived') === 'true';

	// Build query conditions
	const conditions = [];
	
	// By default, only show active and maintenance items
	if (!showArchived) {
		conditions.push(or(eq(catalogItems.status, 'active'), eq(catalogItems.status, 'maintenance')));
	}

	if (category) {
		conditions.push(eq(catalogItems.category, category));
	}

	if (search) {
		conditions.push(
			or(
				like(catalogItems.name, `%${search}%`),
				like(catalogItems.description, `%${search}%`)
			)
		);
	}

	const items = await db
		.select({
			id: catalogItems.id,
			slug: catalogItems.slug,
			name: catalogItems.name,
			description: catalogItems.description,
			category: catalogItems.category,
			url: catalogItems.url,
			iconUrl: catalogItems.iconUrl,
			screenshotUrl: catalogItems.screenshotUrl,
			status: catalogItems.status,
			innovationId: catalogItems.innovationId,
			createdAt: catalogItems.createdAt
		})
		.from(catalogItems)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(catalogItems.createdAt));

	const catalogItemsList: CatalogItemSummary[] = items.map(item => ({
		...item,
		category: item.category as InnovationCategory,
		status: item.status as 'active' | 'maintenance' | 'archived'
	}));

	// Get category counts for active items
	const allActiveItems = await db
		.select({ category: catalogItems.category })
		.from(catalogItems)
		.where(or(eq(catalogItems.status, 'active'), eq(catalogItems.status, 'maintenance')));

	const categoryCounts = allActiveItems.reduce((acc, item) => {
		acc[item.category] = (acc[item.category] || 0) + 1;
		return acc;
	}, {} as Record<string, number>);

	return {
		catalogItems: catalogItemsList,
		categoryCounts,
		filters: {
			category,
			search,
			showArchived
		}
	};
};
