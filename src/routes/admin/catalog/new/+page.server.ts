import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { catalogItems, innovations, votes } from '$lib/server/db/schema';
import { eq, desc, count } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { nanoid } from 'nanoid';

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

export const load: PageServerLoad = async () => {
	// Get published innovations for linking (optional)
	const publishedInnovations = await db
		.select({
			id: innovations.id,
			title: innovations.title,
			category: innovations.category,
			voteCount: count(votes.id)
		})
		.from(innovations)
		.leftJoin(votes, eq(votes.innovationId, innovations.id))
		.where(eq(innovations.status, 'published'))
		.groupBy(innovations.id)
		.orderBy(desc(count(votes.id)));

	// Get already promoted innovation IDs
	const promotedIds = await db
		.select({ innovationId: catalogItems.innovationId })
		.from(catalogItems);

	const promotedIdSet = new Set(promotedIds.map(p => p.innovationId).filter(Boolean));

	return {
		availableInnovations: publishedInnovations.filter(i => !promotedIdSet.has(i.id))
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const formData = await request.formData();

		const name = formData.get('name') as string;
		const description = formData.get('description') as string;
		const category = formData.get('category') as string;
		const url = formData.get('url') as string;
		const howTo = formData.get('howTo') as string;
		const iconUrl = formData.get('iconUrl') as string || null;
		const screenshotUrl = formData.get('screenshotUrl') as string || null;
		const status = formData.get('status') as 'active' | 'maintenance';
		const innovationId = formData.get('innovationId') as string || null;

		// Validation
		if (!name || !description || !category || !url || !howTo) {
			return fail(400, {
				error: 'Please fill in all required fields',
				values: { name, description, category, url, howTo, iconUrl, screenshotUrl, status, innovationId }
			});
		}

		// Validate URL
		try {
			new URL(url);
		} catch {
			return fail(400, {
				error: 'Please enter a valid URL',
				values: { name, description, category, url, howTo, iconUrl, screenshotUrl, status, innovationId }
			});
		}

		const id = nanoid();
		const slug = slugify(name) + '-' + nanoid(6);

		try {
			await db.insert(catalogItems).values({
				id,
				innovationId: innovationId || null,
				name,
				slug,
				description,
				category: category as any,
				url,
				howTo,
				iconUrl,
				screenshotUrl,
				status: status || 'active',
				addedBy: locals.user?.id
			});

			// If linked to an innovation, update its status
			if (innovationId) {
				await db
					.update(innovations)
					.set({
						status: 'promoted',
						promotedAt: new Date()
					})
					.where(eq(innovations.id, innovationId));
			}
		} catch (error) {
			console.error('Error creating catalog item:', error);
			return fail(500, {
				error: 'Failed to create catalog item',
				values: { name, description, category, url, howTo, iconUrl, screenshotUrl, status, innovationId }
			});
		}

		throw redirect(303, '/admin/catalog');
	}
};
