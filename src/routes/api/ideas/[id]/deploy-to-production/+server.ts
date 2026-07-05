import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { base } from '$app/paths';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { peekMetadata } from '$lib/server/services/buildLauncher';
import { jiraService } from '$lib/server/services/jira';

/**
 * POST /api/ideas/{id}/deploy-to-production
 *
 * User-initiated promotion of a built application. Creates a Jira issue asking
 * for the app to be moved to production, and records it on the idea. This is a
 * separate flow from the spec-review publish (approveAndPublishSpec).
 *
 * - Any logged-in user may trigger it.
 * - Only allowed once the build is actually deployed.
 * - Idempotent: if already requested, returns the existing Jira issue.
 */
export const POST: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	const ideaId = params.id;
	if (!ideaId) throw error(400, 'Missing idea ID');

	const [idea] = await db.select().from(ideas).where(eq(ideas.id, ideaId)).limit(1);
	if (!idea) throw error(404, 'Idea not found');

	// Idempotency: already requested → return the existing issue.
	if (idea.productionJiraKey && idea.productionJiraUrl) {
		return json({
			alreadyRequested: true,
			key: idea.productionJiraKey,
			url: idea.productionJiraUrl
		});
	}

	// The app must actually be built & deployed before it can be promoted.
	if (!idea.workspaceUuid) {
		throw error(400, 'This idea has not been built yet');
	}
	const meta = peekMetadata(idea.workspaceUuid);
	if (!meta || meta.status !== 'deployed') {
		throw error(400, 'The application must be deployed before it can be promoted to production');
	}

	// Resolve the URL where the built app can be viewed.
	const appUrl =
		meta.pipeline === 'external'
			? (meta.deployUrl ?? null)
			: `${url.origin}${base}/apps/${idea.workspaceUuid}/v${meta.currentVersion ?? 1}/`;

	const summary = `[Deploy to Production] ${idea.title}`;
	const description = [
		`A built application is ready to be promoted to production.`,
		``,
		`**Idea:** ${idea.title}`,
		`**Summary:** ${idea.summary}`,
		appUrl ? `**Application:** ${appUrl}` : `**Application:** (deployed off-platform)`,
		``,
		`Please review the application and move it to production to make it official.`
	].join('\n');

	const jiraResult = await jiraService.createIssue(summary, description);
	if (!jiraResult) {
		// Jira not configured / project key missing / API failure.
		throw error(503, 'Could not create the Jira issue. Jira is not configured or is unavailable.');
	}

	await db
		.update(ideas)
		.set({
			productionJiraKey: jiraResult.key,
			productionJiraUrl: jiraResult.url,
			updatedAt: new Date()
		})
		.where(eq(ideas.id, ideaId));

	return json({ key: jiraResult.key, url: jiraResult.url });
};
