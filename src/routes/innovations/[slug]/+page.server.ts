import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { db, innovations, votes, tags, innovationTags, catalogItems } from '$lib/server/db';
import { eq, sql, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { InnovationDetail, InnovationResearchData } from '$lib/types';

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		throw redirect(302, '/auth/login');
	}

	const userId = locals.user.id;
	const isAdmin = locals.user.role === 'admin';
	
	// Get innovation by slug with vote count using LEFT JOIN
	const innovationData = await db
		.select({
			id: innovations.id,
			slug: innovations.slug,
			title: innovations.title,
			tagline: innovations.tagline,
			category: innovations.category,
			heroImageUrl: innovations.heroImageUrl,
			isOpenSource: innovations.isOpenSource,
			isSelfHosted: innovations.isSelfHosted,
			hasAiComponent: innovations.hasAiComponent,
			maturityLevel: innovations.maturityLevel,
			license: innovations.license,
			githubUrl: innovations.githubUrl,
			documentationUrl: innovations.documentationUrl,
			relevanceScore: innovations.relevanceScore,
			innovationScore: innovations.innovationScore,
			actionabilityScore: innovations.actionabilityScore,
			researchData: innovations.researchData,
			publishedAt: innovations.publishedAt,
			status: innovations.status,
			voteCount: count(votes.id).as('vote_count')
		})
		.from(innovations)
		.leftJoin(votes, eq(votes.innovationId, innovations.id))
		.where(eq(innovations.slug, params.slug))
		.groupBy(innovations.id);
	
	const [innovation] = innovationData;
	
	if (!innovation) {
		throw error(404, 'Innovation not found');
	}
	
	// Non-admins can only see published or promoted innovations
	const isPubliclyVisible = innovation.status === 'published' || innovation.status === 'promoted';
	if (!isPubliclyVisible && !isAdmin) {
		throw error(404, 'Innovation not found');
	}
	
	// Check if user has voted
	let hasVoted = false;
	if (userId) {
		const [vote] = await db
			.select()
			.from(votes)
			.where(
				and(
					eq(votes.userId, userId),
					eq(votes.innovationId, innovation.id)
				)
			);
		hasVoted = !!vote;
	}
	
	// Get tags
	const innovationTagsData = await db
		.select({ name: tags.name })
		.from(innovationTags)
		.innerJoin(tags, eq(innovationTags.tagId, tags.id))
		.where(eq(innovationTags.innovationId, innovation.id));
	
	// Parse research data
	let researchData: InnovationResearchData;
	try {
		researchData = JSON.parse(innovation.researchData);
	} catch {
		researchData = {
			executiveSummary: '',
			keyBenefits: [],
			useCases: [],
			competitors: [],
			prosAndCons: { pros: [], cons: [] },
			requiredSkills: [],
			estimatedTimeToMVP: '',
			sources: []
		};
	}
	
	const detail: InnovationDetail = {
		id: innovation.id,
		slug: innovation.slug,
		title: innovation.title,
		tagline: innovation.tagline,
		category: innovation.category as InnovationDetail['category'],
		heroImageUrl: innovation.heroImageUrl,
		isOpenSource: innovation.isOpenSource ?? false,
		isSelfHosted: innovation.isSelfHosted ?? false,
		hasAiComponent: innovation.hasAiComponent ?? false,
		maturityLevel: innovation.maturityLevel as InnovationDetail['maturityLevel'],
		license: innovation.license,
		githubUrl: innovation.githubUrl,
		documentationUrl: innovation.documentationUrl,
		relevanceScore: innovation.relevanceScore,
		innovationScore: innovation.innovationScore,
		actionabilityScore: innovation.actionabilityScore,
		voteCount: innovation.voteCount,
		hasVoted,
		publishedAt: innovation.publishedAt,
		researchData,
		tags: innovationTagsData.map(t => t.name)
	};

	// Check if already promoted to catalog (for admin UI)
	let catalogItem = null;
	if (isAdmin) {
		const existingCatalogItem = await db
			.select({ id: catalogItems.id, slug: catalogItems.slug, status: catalogItems.status })
			.from(catalogItems)
			.where(eq(catalogItems.innovationId, innovation.id))
			.limit(1);
		
		if (existingCatalogItem.length) {
			catalogItem = existingCatalogItem[0];
		}
	}
	
	return { 
		innovation: detail,
		isAdmin,
		innovationStatus: innovation.status,
		catalogItem
	};
};

export const actions: Actions = {
	promote: async ({ params, locals, request }) => {
		// Check admin permission
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Permission denied' });
		}

		const formData = await request.formData();
		const deploymentType = formData.get('deploymentType') as 'saas' | 'self-hosted' | null;

		if (!deploymentType || !['saas', 'self-hosted'].includes(deploymentType)) {
			return fail(400, { error: 'Invalid deployment type' });
		}

		// Get innovation
		const innovationData = await db
			.select()
			.from(innovations)
			.where(eq(innovations.slug, params.slug))
			.limit(1);

		if (!innovationData.length) {
			return fail(404, { error: 'Innovation not found' });
		}

		const innovation = innovationData[0];

		// Check if already promoted
		const existing = await db
			.select()
			.from(catalogItems)
			.where(eq(catalogItems.innovationId, innovation.id))
			.limit(1);

		if (existing.length) {
			return fail(400, { error: 'Already promoted to catalog' });
		}

		// Create catalog item
		const id = nanoid();
		const catalogSlug = slugify(innovation.title) + '-' + nanoid(6);

		// Set defaults based on deployment type
		const isSelfHosted = deploymentType === 'self-hosted';

		await db.insert(catalogItems).values({
			id,
			innovationId: innovation.id,
			name: innovation.title,
			slug: catalogSlug,
			description: innovation.tagline,
			category: innovation.category,
			url: isSelfHosted ? '#self-hosted' : 'https://example.com/placeholder', // Admin needs to update for SaaS
			howTo: isSelfHosted 
				? '## Getting Started\n\nThis is a self-hosted deployment. Click "Deploy My Instance" to create your own instance.\n\n## Prerequisites\n\n- Corporate SSO login required\n- Deployment permissions\n\n## After Deployment\n\nOnce deployed, click "Open My Instance" to access your personal instance.'
				: '## Getting Started\n\nPlease update this section with instructions on how to use this implementation.\n\n## Prerequisites\n\n- List prerequisites here\n\n## Steps\n\n1. First step\n2. Second step\n3. Third step',
			status: 'maintenance', // Start in maintenance
			deploymentType: deploymentType,
			addedBy: locals.user.id
		});

		// Update innovation status
		await db
			.update(innovations)
			.set({
				status: 'promoted',
				promotedAt: new Date()
			})
			.where(eq(innovations.id, innovation.id));

		throw redirect(303, `/admin/catalog/${id}/edit`);
	},
	archive: async ({ params, locals }) => {
		// Check admin permission
		if (locals.user?.role !== 'admin') {
			return fail(403, { error: 'Permission denied' });
		}

		// Get innovation
		const innovationData = await db
			.select()
			.from(innovations)
			.where(eq(innovations.slug, params.slug))
			.limit(1);

		if (!innovationData.length) {
			return fail(404, { error: 'Innovation not found' });
		}

		const innovation = innovationData[0];

		// Update innovation status
		await db
			.update(innovations)
			.set({
				status: 'archived'
			})
			.where(eq(innovations.id, innovation.id));

		throw redirect(303, `/innovations`);
	}
};
