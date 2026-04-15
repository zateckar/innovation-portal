import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { db, innovations } from '$lib/server/db';
import type { InnovationCategory, DepartmentCategory } from '$lib/types';
import { DEPARTMENTS } from '$lib/types';
import { ideasService } from '$lib/server/services/ideas';

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
		const proposalType = formData.get('proposalType')?.toString() ?? 'innovation';

		if (proposalType === 'idea') {
			return await handleIdeaProposal(formData, locals.user);
		}

		return await handleInnovationProposal(formData, locals.user);
	}
};

async function handleInnovationProposal(
	formData: FormData,
	user: { id: string; email: string }
) {
	const title = formData.get('title')?.toString()?.trim();
	const url = formData.get('url')?.toString()?.trim();
	const reason = formData.get('reason')?.toString()?.trim();
	const category = formData.get('category')?.toString() as InnovationCategory;
	const departmentRaw = formData.get('department')?.toString();
	const department: DepartmentCategory = departmentRaw && (DEPARTMENTS as readonly string[]).includes(departmentRaw)
		? (departmentRaw as DepartmentCategory)
		: 'general';
	const isOpenSource = formData.get('isOpenSource') === 'on';
	const isSelfHosted = formData.get('isSelfHosted') === 'on';
	const hasAiComponent = formData.get('hasAiComponent') === 'on';

	// Validation
	if (!title || title.length < 3) {
		return fail(400, { error: 'Title must be at least 3 characters', proposalType: 'innovation', title, url, reason, category, department });
	}

	if (!url) {
		return fail(400, { error: 'URL is required', proposalType: 'innovation', title, url, reason, category, department });
	}

	try {
		new URL(url);
	} catch {
		return fail(400, { error: 'Please enter a valid URL', proposalType: 'innovation', title, url, reason, category, department });
	}

	if (!reason || reason.length < 20) {
		return fail(400, { error: 'Please explain why this is relevant (at least 20 characters)', proposalType: 'innovation', title, url, reason, category, department });
	}

	if (!category) {
		return fail(400, { error: 'Please select a category', proposalType: 'innovation', title, url, reason, category, department });
	}

	const validCategories: InnovationCategory[] = ['ai-ml', 'devops', 'security', 'data-analytics', 'developer-tools', 'automation', 'collaboration', 'infrastructure'];
	if (!validCategories.includes(category)) {
		return fail(400, { error: 'Invalid category', proposalType: 'innovation', title, url, reason, category, department });
	}

	// Create the innovation
	const id = crypto.randomUUID();
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
		department,
		researchData,
		isOpenSource,
		isSelfHosted,
		hasAiComponent,
		status: 'published', // No approval needed per design decision
		submittedBy: user.id,
		publishedAt: new Date()
	});

	throw redirect(302, `/innovations/${slug}`);
}

async function handleIdeaProposal(
	formData: FormData,
	user: { id: string; email: string }
) {
	const title = formData.get('ideaTitle')?.toString()?.trim();
	const summary = formData.get('ideaSummary')?.toString()?.trim();
	const problem = formData.get('ideaProblem')?.toString()?.trim();
	const solution = formData.get('ideaSolution')?.toString()?.trim();
	const department = formData.get('ideaDepartment')?.toString() as DepartmentCategory;

	// Validation
	if (!title || title.length < 3) {
		return fail(400, { error: 'Title must be at least 3 characters', proposalType: 'idea', ideaTitle: title, ideaSummary: summary, ideaProblem: problem, ideaSolution: solution, ideaDepartment: department });
	}

	if (!summary || summary.length < 20) {
		return fail(400, { error: 'Summary must be at least 20 characters', proposalType: 'idea', ideaTitle: title, ideaSummary: summary, ideaProblem: problem, ideaSolution: solution, ideaDepartment: department });
	}

	if (!problem || problem.length < 20) {
		return fail(400, { error: 'Problem description must be at least 20 characters', proposalType: 'idea', ideaTitle: title, ideaSummary: summary, ideaProblem: problem, ideaSolution: solution, ideaDepartment: department });
	}

	if (!solution || solution.length < 20) {
		return fail(400, { error: 'Solution description must be at least 20 characters', proposalType: 'idea', ideaTitle: title, ideaSummary: summary, ideaProblem: problem, ideaSolution: solution, ideaDepartment: department });
	}

	if (!department) {
		return fail(400, { error: 'Please select a department', proposalType: 'idea', ideaTitle: title, ideaSummary: summary, ideaProblem: problem, ideaSolution: solution, ideaDepartment: department });
	}

	if (!(DEPARTMENTS as readonly string[]).includes(department)) {
		return fail(400, { error: 'Invalid department', proposalType: 'idea', ideaTitle: title, ideaSummary: summary, ideaProblem: problem, ideaSolution: solution, ideaDepartment: department });
	}

	// Insert idea immediately, then run AI evaluation in the background.
	// This way the user sees the redirect within ~1 second instead of waiting
	// 30-60s for AI evaluation to finish.
	try {
		const { slug } = await ideasService.proposeUserIdeaFast({
			title,
			summary,
			problem,
			solution,
			department,
			proposedBy: user.id,
			proposedByEmail: user.email
		});

		throw redirect(302, `/ideas/${slug}`);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e; // re-throw redirects
		if (e && typeof e === 'object' && 'location' in e) throw e; // re-throw redirects
		console.error('[propose] Idea proposal failed:', e);
		return fail(500, { error: 'Failed to submit idea. Please try again.', proposalType: 'idea', ideaTitle: title, ideaSummary: summary, ideaProblem: problem, ideaSolution: solution, ideaDepartment: department });
	}
}
