import { marked } from 'marked';

// Configure marked to match the options previously used with Bun.markdown.html()
marked.setOptions({
	gfm: true,        // tables, strikethrough, tasklists
	breaks: false,
});

/**
 * Render a Markdown string to HTML.
 * Works in both server (Bun) and client (browser) environments.
 */
export function renderMarkdown(source: string): string {
	if (!source) return '';
	return marked.parse(source, { async: false }) as string;
}
