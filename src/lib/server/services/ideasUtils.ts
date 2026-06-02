/**
 * Pure helpers extracted from ideas.ts so the service file can focus on
 * orchestration. None of these touch the DB or external services; they are
 * safe to import from tests and from any future split of the IdeasService.
 */

/** Make a URL-safe slug from a title. Id suffix guarantees uniqueness. */
export function generateSlug(title: string, id: string): string {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '')
			.slice(0, 50) +
		'-' +
		id.slice(0, 6)
	);
}

/** Sleep for `ms` milliseconds — used between batched AI calls. */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** JSON.parse that returns null on any error or empty input. */
export function safeParseJSON<T>(value: string | null | undefined): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}
