import { db } from '$lib/server/db';
import { settings } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export interface AdoCredentials {
	orgUrl: string;      // e.g. https://dev.azure.com/myorg
	project: string;
	repoId: string;
	pat: string;
	targetBranch: string; // e.g. main
}

export interface AdoPrResult {
	prUrl: string;
	prId: number;
}

class AdoService {
	private buildHeaders(pat: string): Record<string, string> {
		const token = Buffer.from(`:${pat}`).toString('base64');
		return {
			Authorization: `Basic ${token}`,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		};
	}

	private apiUrl(creds: AdoCredentials, path: string): string {
		return `${creds.orgUrl}/${encodeURIComponent(creds.project)}/_apis/git/repositories/${encodeURIComponent(creds.repoId)}/${path}`;
	}

	async getCredentials(): Promise<AdoCredentials | null> {
		const [row] = await db.select().from(settings).where(eq(settings.id, 'default')).limit(1);
		if (!row?.adoEnabled || !row.adoOrgUrl || !row.adoProject || !row.adoRepoId || !row.adoPat) {
			return null;
		}
		return {
			orgUrl: row.adoOrgUrl,
			project: row.adoProject,
			repoId: row.adoRepoId,
			pat: row.adoPat,
			targetBranch: row.adoTargetBranch ?? 'main'
		};
	}

	async testConnection(creds?: AdoCredentials): Promise<{ ok: boolean; message: string }> {
		try {
			const c = creds ?? await this.getCredentials();
			if (!c) return { ok: false, message: 'ADO integration is not configured.' };
			const url = `${c.orgUrl}/${encodeURIComponent(c.project)}/_apis/git/repositories/${encodeURIComponent(c.repoId)}?api-version=7.1`;
			const res = await fetch(url, { headers: this.buildHeaders(c.pat) });
			if (!res.ok) {
				const body = await res.text();
				return { ok: false, message: `ADO returned ${res.status}: ${body.slice(0, 200)}` };
			}
			return { ok: true, message: 'Connection successful.' };
		} catch (err) {
			return { ok: false, message: String(err) };
		}
	}

	/**
	 * Creates a new branch from the tip of `targetBranch`, commits the spec
	 * file to it, then opens a pull request back to `targetBranch`.
	 *
	 * Branch name: `spec/<ideaSlug>`
	 * File path:   `specs/<ideaSlug>.md`
	 */
	async createPullRequest(
		ideaSlug: string,
		ideaTitle: string,
		specMarkdown: string,
		creds?: AdoCredentials
	): Promise<AdoPrResult> {
		const c = creds ?? await this.getCredentials();
		if (!c) throw new Error('ADO integration is not configured.');

		const headers = this.buildHeaders(c.pat);
		const apiVersion = 'api-version=7.1';

		// 1. Get the latest commit SHA of the target branch
		const refsUrl = `${c.orgUrl}/${encodeURIComponent(c.project)}/_apis/git/repositories/${encodeURIComponent(c.repoId)}/refs?filter=heads/${c.targetBranch}&${apiVersion}`;
		const refsRes = await fetch(refsUrl, { headers });
		if (!refsRes.ok) throw new Error(`Failed to get refs: ${refsRes.status}`);
		const refsData = await refsRes.json() as { value: { objectId: string }[] };
		const baseCommitId = refsData.value[0]?.objectId;
		if (!baseCommitId) throw new Error(`Branch '${c.targetBranch}' not found in repository.`);

		const newBranch = `spec/${ideaSlug}`;
		const filePath = `specs/${ideaSlug}.md`;
		const fileContent = Buffer.from(specMarkdown).toString('base64');

		// 2. Create branch + commit file in one push
		const pushUrl = this.apiUrl(c, `pushes?${apiVersion}`);
		const pushBody = {
			refUpdates: [{ name: `refs/heads/${newBranch}`, oldObjectId: '0000000000000000000000000000000000000000' }],
			commits: [{
				comment: `feat: add specification for idea "${ideaTitle}"`,
				changes: [{
					changeType: 'add',
					item: { path: `/${filePath}` },
					newContent: { content: fileContent, contentType: 'base64Encoded' }
				}]
			}]
		};

		// If the branch already exists, use the current tip instead of zeros
		let pushRes = await fetch(pushUrl, { method: 'POST', headers, body: JSON.stringify(pushBody) });
		if (!pushRes.ok && pushRes.status === 400) {
			// Branch may already exist — try updating it
			const existingRefsRes = await fetch(
				`${c.orgUrl}/${encodeURIComponent(c.project)}/_apis/git/repositories/${encodeURIComponent(c.repoId)}/refs?filter=heads/${newBranch}&${apiVersion}`,
				{ headers }
			);
			const existingRefs = await existingRefsRes.json() as { value: { objectId: string }[] };
			const existingOid = existingRefs.value[0]?.objectId ?? baseCommitId;
			pushBody.refUpdates[0].oldObjectId = existingOid;
			// Change file operation to 'edit' if branch existed
			pushBody.commits[0].changes[0].changeType = existingOid !== '0000000000000000000000000000000000000000' ? 'edit' : 'add';
			pushRes = await fetch(pushUrl, { method: 'POST', headers, body: JSON.stringify(pushBody) });
		}
		if (!pushRes.ok) {
			const body = await pushRes.text();
			throw new Error(`Failed to push spec file: ${pushRes.status} — ${body.slice(0, 300)}`);
		}

		// 3. Create pull request
		const prUrl = this.apiUrl(c, `pullrequests?${apiVersion}`);
		const prBody = {
			title: `Spec: ${ideaTitle}`,
			description: `Automatically generated specification document for idea "${ideaTitle}".\n\nFile: \`${filePath}\``,
			sourceRefName: `refs/heads/${newBranch}`,
			targetRefName: `refs/heads/${c.targetBranch}`
		};
		const prRes = await fetch(prUrl, { method: 'POST', headers, body: JSON.stringify(prBody) });
		if (!prRes.ok) {
			const body = await prRes.text();
			throw new Error(`Failed to create pull request: ${prRes.status} — ${body.slice(0, 300)}`);
		}
		const prData = await prRes.json() as { pullRequestId: number; url: string; _links?: { web?: { href: string } } };
		const webUrl = prData._links?.web?.href ?? `${c.orgUrl}/${encodeURIComponent(c.project)}/_git/${encodeURIComponent(c.repoId)}/pullrequest/${prData.pullRequestId}`;

		return { prUrl: webUrl, prId: prData.pullRequestId };
	}
}

export const adoService = new AdoService();
