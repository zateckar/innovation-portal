import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { db, innovations } from '$lib/server/db';
import { nanoid } from 'nanoid';
import type { InnovationCategory } from '$lib/types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login?redirect=/propose');
	}
	return {};
};

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) {
			throw redirect(302, '/auth/login');
		}
		
		const formData = await request.formData();
		const title = formData.get('title')?.toString()?.trim();
		const url = formData.get('url')?.toString()?.trim();
		const reason = formData.get('reason')?.toString()?.trim();
		const category = formData.get('category')?.toString() as InnovationCategory;
		const isOpenSource = formData.get('isOpenSource') === 'on';
		const isSelfHosted = formData.get('isSelfHosted') === 'on';
		const hasAiComponent = formData.get('hasAiComponent') === 'on';
		
		// Validation
		if (!title || title.length < 3) {
			return fail(400, { error: 'Title must be at least 3 characters', title, url, reason, category });
		}
		
		if (!url) {
			return fail(400, { error: 'URL is required', title, url, reason, category });
		}
		
		try {
			new URL(url);
		} catch {
			return fail(400, { error: 'Please enter a valid URL', title, url, reason, category });
		}
		
		if (!reason || reason.length < 20) {
			return fail(400, { error: 'Please explain why this is relevant (at least 20 characters)', title, url, reason, category });
		}
		
		if (!category) {
			return fail(400, { error: 'Please select a category', title, url, reason, category });
		}
		
		const validCategories: InnovationCategory[] = ['ai-ml', 'devops', 'security', 'data-analytics', 'developer-tools', 'automation', 'collaboration', 'infrastructure'];
		if (!validCategories.includes(category)) {
			return fail(400, { error: 'Invalid category', title, url, reason, category });
		}
		
		// Create the innovation
		const id = nanoid();
		const slug = slugify(title) + '-' + id.slice(0, 6);
		
		// Create basic research data from user input
		const researchData = JSON.stringify({
			executiveSummary: reason,
			keyBenefits: [],
			useCases: [],
			competitors: [],
			prosAndCons: { pros: [], cons: [] },
			requiredSkills: [],
			estimatedTimeToMVP: 'To be determined',
			sources: [{ url, title: 'Original submission', type: 'original' }]
		});
		
		await db.insert(innovations).values({
			id,
			slug,
			title,
			tagline: reason.slice(0, 150) + (reason.length > 150 ? '...' : ''),
			category,
			researchData,
			isOpenSource,
			isSelfHosted,
			hasAiComponent,
			status: 'published', // No approval needed per design decision
			submittedBy: locals.user.id,
			publishedAt: new Date()
		});
		
		throw redirect(302, `/innovations/${slug}`);
	}
};
