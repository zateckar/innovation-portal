import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { catalogItems, innovations, votes } from '$lib/server/db/schema';
import { eq, desc, count, sql } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { nanoid } from 'nanoid';
import type { InnovationCategory, CatalogItemStatus } from '$lib/types';

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

export const load: PageServerLoad = async () => {
	// Get all catalog items with related innovation info
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

	// Get top voted published innovations that are not yet in catalog (for promotion suggestions)
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

	// Filter out already promoted ones
	const suggestedForPromotion = topVotedInnovations.filter(
		i => !existingInnovationIds.includes(i.id)
	);

	return {
		catalogItems: items.map(item => ({
			...item,
			category: item.category as InnovationCategory,
			status: item.status as CatalogItemStatus
		})),
		suggestedForPromotion
	};
};

export const actions: Actions = {
	archive: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Missing catalog item ID' });
		}

		await db
			.update(catalogItems)
			.set({
				status: 'archived',
				archivedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(catalogItems.id, id));

		return { success: true, message: 'Item archived successfully' };
	},

	restore: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Missing catalog item ID' });
		}

		await db
			.update(catalogItems)
			.set({
				status: 'active',
				archivedAt: null,
				updatedAt: new Date()
			})
			.where(eq(catalogItems.id, id));

		return { success: true, message: 'Item restored successfully' };
	},

	setMaintenance: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Missing catalog item ID' });
		}

		await db
			.update(catalogItems)
			.set({
				status: 'maintenance',
				updatedAt: new Date()
			})
			.where(eq(catalogItems.id, id));

		return { success: true, message: 'Item set to maintenance mode' };
	},

	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Missing catalog item ID' });
		}

		await db.delete(catalogItems).where(eq(catalogItems.id, id));

		return { success: true, message: 'Item deleted permanently' };
	},

	quickPromote: async ({ request, locals }) => {
		const formData = await request.formData();
		const innovationId = formData.get('innovationId') as string;

		if (!innovationId) {
			return fail(400, { error: 'Missing innovation ID' });
		}

		// Get innovation data
		const innovation = await db
			.select()
			.from(innovations)
			.where(eq(innovations.id, innovationId))
			.limit(1);

		if (!innovation.length) {
			return fail(404, { error: 'Innovation not found' });
		}

		const innovationData = innovation[0];

		// Check if already promoted
		const existing = await db
			.select()
			.from(catalogItems)
			.where(eq(catalogItems.innovationId, innovationId))
			.limit(1);

		if (existing.length) {
			return fail(400, { error: 'Innovation already promoted to catalog' });
		}

		// Create catalog item with placeholder data
		const id = nanoid();
		const slug = slugify(innovationData.title) + '-' + nanoid(6);

		await db.insert(catalogItems).values({
			id,
			innovationId,
			name: innovationData.title,
			slug,
			description: innovationData.tagline,
			category: innovationData.category,
			url: 'https://example.com/placeholder', // Admin needs to update this
			howTo: '## Getting Started\n\nPlease update this section with instructions on how to use this implementation.\n\n## Prerequisites\n\n- List prerequisites here\n\n## Steps\n\n1. First step\n2. Second step\n3. Third step',
			status: 'maintenance', // Start in maintenance until admin completes setup
			addedBy: locals.user?.id
		});

		// Update innovation status to promoted
		await db
			.update(innovations)
			.set({
				status: 'promoted',
				promotedAt: new Date()
			})
			.where(eq(innovations.id, innovationId));

		return { 
			success: true, 
			message: 'Innovation promoted! Please complete the catalog item details.',
			itemId: id 
		};
	}
};
