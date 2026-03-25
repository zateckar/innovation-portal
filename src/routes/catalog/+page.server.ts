import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { catalogItems } from '$lib/server/db/schema';
import { eq, and, like, desc, or, isNull } from 'drizzle-orm';
import type { CatalogItemSummary, InnovationCategory, DepartmentCategory } from '$lib/types';
import { DEPARTMENTS } from '$lib/types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const deptParam = url.searchParams.get('department');
	const department: DepartmentCategory | null =
		deptParam && (DEPARTMENTS as readonly string[]).includes(deptParam)
			? (deptParam as DepartmentCategory)
			: null;
	const search = url.searchParams.get('q');
	const showArchived = url.searchParams.get('archived') === 'true';

	// Build query conditions
	const conditions = [];

	// By default, only show active and maintenance items
	if (!showArchived) {
		conditions.push(or(eq(catalogItems.status, 'active'), eq(catalogItems.status, 'maintenance')));
	}

	if (department) {
		if (department === 'general') {
			conditions.push(or(eq(catalogItems.department, 'general'), isNull(catalogItems.department))!);
		} else {
			conditions.push(eq(catalogItems.department, department));
		}
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
			department: catalogItems.department,
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
		department: (item.department ?? null) as DepartmentCategory | null,
		status: item.status as 'active' | 'maintenance' | 'archived'
	}));

	return {
		catalogItems: catalogItemsList,
		filters: {
			department,
			search,
			showArchived
		}
	};
};
