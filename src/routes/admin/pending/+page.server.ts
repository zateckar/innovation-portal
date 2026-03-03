import type { PageServerLoad, Actions } from './$types';
import { db, rawItems, sources, innovations } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
	// Get pending items
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
	
	// Get accepted items awaiting research
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
	
	// Get researched innovations awaiting publication
	const pendingInnovations = await db
		.select({
			id: innovations.id,
			slug: innovations.slug,
			title: innovations.title,
			tagline: innovations.tagline,
			category: innovations.category,
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
	
	return {
		pendingItems,
		acceptedItems,
		pendingInnovations
	};
};

export const actions: Actions = {
	accept: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		
		if (!id) {
			return fail(400, { error: 'Item ID required' });
		}
		
		await db
			.update(rawItems)
			.set({ status: 'accepted' })
			.where(eq(rawItems.id, id));
		
		return { success: true, message: 'Item accepted for research' };
	},
	
	reject: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		
		if (!id) {
			return fail(400, { error: 'Item ID required' });
		}
		
		await db
			.update(rawItems)
			.set({ status: 'rejected' })
			.where(eq(rawItems.id, id));
		
		return { success: true, message: 'Item rejected' };
	},
	
	publish: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		
		if (!id) {
			return fail(400, { error: 'Innovation ID required' });
		}
		
		await db
			.update(innovations)
			.set({ 
				status: 'published',
				publishedAt: new Date()
			})
			.where(eq(innovations.id, id));
		
		return { success: true, message: 'Innovation published successfully!' };
	},
	
	archive: async ({ request }) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		
		if (!id) {
			return fail(400, { error: 'Innovation ID required' });
		}
		
		await db
			.update(innovations)
			.set({ status: 'archived' })
			.where(eq(innovations.id, id));
		
		return { success: true, message: 'Innovation archived' };
	}
};
