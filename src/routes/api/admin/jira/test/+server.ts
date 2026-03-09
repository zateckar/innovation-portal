import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { jiraService } from '$lib/server/services/jira';

export const POST: RequestHandler = async ({ request, locals }) => {
	// Admin only
	if (locals.user?.role !== 'admin') {
		return json({ success: false, message: 'Forbidden' }, { status: 403 });
	}

	let body: {
		jiraUrl?: string;
		jiraApimSubscriptionKey?: string;
		jiraMtlsCert?: string;
		jiraMtlsKey?: string;
	} = {};

	try {
		body = await request.json();
	} catch {
		// If body parsing fails, fall back to DB settings
	}

	const result = await jiraService.testConnection({
		jiraUrl: body.jiraUrl,
		jiraApimSubscriptionKey: body.jiraApimSubscriptionKey ?? null,
		jiraMtlsCert: body.jiraMtlsCert ?? null,
		jiraMtlsKey: body.jiraMtlsKey ?? null
	});

	return json(result);
};
