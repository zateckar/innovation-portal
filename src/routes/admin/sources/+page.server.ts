import type { PageServerLoad, Actions } from './$types';
import { db, sources } from '$lib/server/db';
import { eq, desc } from 'drizzle-orm';
import { fail } from '@sveltejs/kit';
import { nanoid } from 'nanoid';

export const load: PageServerLoad = async () => {
	const allSources = await db.select()
		.from(sources)
		.orderBy(desc(sources.createdAt));
	
	return { sources: allSources };
};

export const actions: Actions = {
	add: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const name = formData.get('name')?.toString()?.trim();
		const type = formData.get('type')?.toString() as 'rss' | 'api' | 'scrape';
		const url = formData.get('url')?.toString()?.trim();
		const intervalStr = formData.get('interval')?.toString();
		const interval = intervalStr ? parseInt(intervalStr, 10) : 120;
		
		if (!name || !type || !url) {
			return fail(400, { error: 'All fields are required' });
		}
		
		try {
			new URL(url);
		} catch {
			return fail(400, { error: 'Invalid URL' });
		}
		
		await db.insert(sources).values({
			id: nanoid(),
			name,
			type,
			url,
			scanIntervalMinutes: interval,
			enabled: true
		});
		
		return { success: true };
	},
	
	toggle: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id')?.toString();
		const enabled = formData.get('enabled') === 'true';
		
		if (!id) {
			return fail(400, { error: 'Source ID required' });
		}
		
		await db.update(sources)
			.set({ enabled: !enabled })
			.where(eq(sources.id, id));
		
		return { success: true };
	},
	
	delete: async ({ request, locals }) => {
		if (!locals.user || locals.user.role !== 'admin') {
			return fail(403, { error: 'Forbidden' });
		}
		const formData = await request.formData();
		const id = formData.get('id')?.toString();
		
		if (!id) {
			return fail(400, { error: 'Source ID required' });
		}
		
		await db.delete(sources).where(eq(sources.id, id));
		
		return { success: true };
	}
};
