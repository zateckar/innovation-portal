import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { ideas } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const GET = async ({ params, locals }: { params: { id: string }; locals: App.Locals }) => {
	if (!locals.user) {
		throw error(401, 'Unauthorized');
	}

	const [idea] = await db
		.select({ id: ideas.id, slug: ideas.slug, title: ideas.title, specDocument: ideas.specDocument, specStatus: ideas.specStatus })
		.from(ideas)
		.where(eq(ideas.id, params.id))
		.limit(1);

	if (!idea) {
		throw error(404, 'Idea not found');
	}

	if (!idea.specDocument) {
		throw error(404, 'No specification document available');
	}

	const filename = `${idea.slug}-specification.md`;

	return new Response(idea.specDocument, {
		headers: {
			'Content-Type': 'text/markdown; charset=utf-8',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Content-Length': String(Buffer.byteLength(idea.specDocument, 'utf8'))
		}
	});
};
