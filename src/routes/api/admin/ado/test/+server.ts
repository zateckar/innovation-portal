import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adoService } from '$lib/server/services/ado';

export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user || locals.user.role !== 'admin') throw error(403, 'Forbidden');

	const body = await request.json() as {
		adoOrgUrl?: string;
		adoProject?: string;
		adoRepoId?: string;
		adoPat?: string;
		adoTargetBranch?: string;
	};

	const creds = body.adoOrgUrl && body.adoProject && body.adoRepoId && body.adoPat
		? {
				orgUrl: body.adoOrgUrl,
				project: body.adoProject,
				repoId: body.adoRepoId,
				pat: body.adoPat,
				targetBranch: body.adoTargetBranch ?? 'main'
			}
		: undefined;

	const result = await adoService.testConnection(creds);
	return json(result);
};
