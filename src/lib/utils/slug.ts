/**
 * Shared slug generation utility.
 * Produces a URL-safe, lowercase slug from a title, suffixed with a short unique ID.
 */

/**
 * Generate a URL-safe slug from a title and a unique identifier.
 * @param title - The source title string
 * @param id    - A unique ID (e.g. nanoid()); the first 6 characters are appended as a suffix
 * @param maxLength - Maximum length of the title portion before the suffix (default 50)
 */
export function generateSlug(title: string, id: string, maxLength = 50): string {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
		.slice(0, maxLength);
	return `${base}-${id.slice(0, 6)}`;
}
