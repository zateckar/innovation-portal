import type { PageServerLoad, Actions } from './$types';
import { db, rawItems, sources, innovations } from '$lib/server/db';
import { catalogItems, votes } from '$lib/server/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import type { InnovationCategory, CatalogItemStatus, DepartmentCategory } from '$lib/types';
import { DEPARTMENTS } from '$lib/types';

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

export const load: PageServerLoad = async () => {
	// --- Pending pipeline data ---
	const pendingItems = await db
		.select({
			id: rawItems.id,
			title: rawItems.title,
			url: rawItems.url,
			content: rawItems.content,
			publishedAt: rawItems.publishedAt,
			discoveredAt: rawItems.discoveredAt,
			status: rawItems.status,
			sourceId: rawItems.sourceId,
			sourceName: sources.name
		})
		.from(rawItems)
		.leftJoin(sources, eq(rawItems.sourceId, sources.id))
		.where(eq(rawItems.status, 'pending'))
		.orderBy(desc(rawItems.discoveredAt))
		.limit(50);

	const acceptedItems = await db
		.select({
			id: rawItems.id,
			title: rawItems.title,
			url: rawItems.url,
			content: rawItems.content,
			publishedAt: rawItems.publishedAt,
			discoveredAt: rawItems.discoveredAt,
			status: rawItems.status,
			sourceId: rawItems.sourceId,
			sourceName: sources.name
		})
		.from(rawItems)
		.leftJoin(sources, eq(rawItems.sourceId, sources.id))
		.where(eq(rawItems.status, 'accepted'))
		.orderBy(desc(rawItems.discoveredAt))
		.limit(50);

	const pendingInnovations = await db
		.select({
			id: innovations.id,
			slug: innovations.slug,
			title: innovations.title,
			tagline: innovations.tagline,
			category: innovations.category,
			department: innovations.department,
			relevanceScore: innovations.relevanceScore,
			innovationScore: innovations.innovationScore,
			actionabilityScore: innovations.actionabilityScore,
			researchedAt: innovations.researchedAt,
			discoveredAt: innovations.discoveredAt
		})
		.from(innovations)
		.where(eq(innovations.status, 'pending'))
		.orderBy(desc(innovations.researchedAt))
		.limit(50);

	// --- Catalog data ---
	const items = await db
		.select({
			id: catalogItems.id,
			slug: catalogItems.slug,
			name: catalogItems.name,
			description: catalogItems.description,
			category: catalogItems.category,
			url: catalogItems.url,
			status: catalogItems.status,
			innovationId: catalogItems.innovationId,
			createdAt: catalogItems.createdAt,
			updatedAt: catalogItems.updatedAt
		})
		.from(catalogItems)
		.orderBy(desc(catalogItems.createdAt));

	const existingInnovationIds = items
		.filter(i => i.innovationId)
		.map(i => i.innovationId);

	const topVotedInnovations = await db
		.select({
			id: innovations.id,
			slug: innovations.slug,
			title: innovations.title,
			tagline: innovations.tagline,
			category: innovations.category,
			voteCount: count(votes.id)
		})
		.from(innovations)
		.leftJoin(votes, eq(votes.innovationId, innovations.id))
		.where(eq(innovations.status, 'published'))
		.groupBy(innovations.id)
		.orderBy(desc(count(votes.id)))
		.limit(10);

	const suggestedForPromotion = topVotedInnovations.filter(
		i => !existingInnovationIds.includes(i.id)
	);

	return {
		// Pending tab
		pendingItems,
		acceptedItems,
		pendingInnovations,
		// Catalog tab
		catalogItems: items.map(item => ({
			...item,
			category: item.category as InnovationCategory,
			status: item.status as CatalogItemStatus
		})),
		suggestedForPromotion
	};
};

export const actions: Actions = {
	// --- Pending actions ---
	accept: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Item ID required' });
		await db.update(rawItems).set({ status: 'accepted' }).where(eq(rawItems.id, id));
		return { success: true, message: 'Item accepted for research' };
	},

	reject: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Item ID required' });
		await db.update(rawItems).set({ status: 'rejected' }).where(eq(rawItems.id, id));
		return { success: true, message: 'Item rejected' };
	},

	publish: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Innovation ID required' });

		const dept = formData.get('department') as string | null;
		const department: DepartmentCategory = (dept && (DEPARTMENTS as readonly string[]).includes(dept))
			? (dept as DepartmentCategory)
			: 'general';

		await db
			.update(innovations)
			.set({ status: 'published', publishedAt: new Date(), department })
			.where(eq(innovations.id, id));
		return { success: true, message: 'Innovation published successfully!' };
	},

	archiveInnovation: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Innovation ID required' });
		await db.update(innovations).set({ status: 'archived' }).where(eq(innovations.id, id));
		return { success: true, message: 'Innovation archived' };
	},

	// --- Catalog actions ---
	archiveCatalog: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Missing catalog item ID' });
		await db
			.update(catalogItems)
			.set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
			.where(eq(catalogItems.id, id));
		return { success: true, message: 'Item archived successfully' };
	},

	restore: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Missing catalog item ID' });
		await db
			.update(catalogItems)
			.set({ status: 'active', archivedAt: null, updatedAt: new Date() })
			.where(eq(catalogItems.id, id));
		return { success: true, message: 'Item restored successfully' };
	},

	setMaintenance: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Missing catalog item ID' });
		await db
			.update(catalogItems)
			.set({ status: 'maintenance', updatedAt: new Date() })
			.where(eq(catalogItems.id, id));
		return { success: true, message: 'Item set to maintenance mode' };
	},

	deleteCatalog: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id') as string;
		if (!id) return fail(400, { error: 'Missing catalog item ID' });
		await db.delete(catalogItems).where(eq(catalogItems.id, id));
		return { success: true, message: 'Item deleted permanently' };
	},

	quickPromote: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const innovationId = formData.get('innovationId') as string;
		if (!innovationId) return fail(400, { error: 'Missing innovation ID' });

		const innovation = await db
			.select()
			.from(innovations)
			.where(eq(innovations.id, innovationId))
			.limit(1);

		if (!innovation.length) return fail(404, { error: 'Innovation not found' });

		const existing = await db
			.select()
			.from(catalogItems)
			.where(eq(catalogItems.innovationId, innovationId))
			.limit(1);

		if (existing.length) return fail(400, { error: 'Innovation already promoted to catalog' });

		const innovationData = innovation[0];
		const id = nanoid();
		const slug = slugify(innovationData.title) + '-' + nanoid(6);

		await db.insert(catalogItems).values({
			id,
			innovationId,
			name: innovationData.title,
			slug,
			description: innovationData.tagline,
			category: innovationData.category,
			department: (innovationData.department as DepartmentCategory) ?? 'general',
			url: 'https://example.com/placeholder',
			howTo:
				'## Getting Started\n\nPlease update this section with instructions on how to use this implementation.\n\n## Prerequisites\n\n- List prerequisites here\n\n## Steps\n\n1. First step\n2. Second step\n3. Third step',
			status: 'maintenance',
			addedBy: locals.user?.id
		});

		await db
			.update(innovations)
			.set({ status: 'promoted', promotedAt: new Date() })
			.where(eq(innovations.id, innovationId));

		return {
			success: true,
			message: 'Innovation promoted! Please complete the catalog item details.',
			itemId: id
		};
	}
};
