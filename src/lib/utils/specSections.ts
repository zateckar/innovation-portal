/**
 * Extracts all ## section headings from a spec document.
 * Returns them in order of appearance.
 */
export function extractSpecSections(specDocument: string | null | undefined): string[] {
	if (!specDocument) return [];
	const matches = specDocument.match(/^##\s+(.+)$/gm);
	if (!matches) return [];
	return matches.map((m) => m.replace(/^##\s+/, '').trim());
}

/**
 * Returns which spec sections (by ## heading) are present and non-empty in the given Markdown document.
 * A section is "complete" if a ## heading exists and is followed by at least 20 characters of content.
 * 
 * When specStatus is 'completed', all detected sections are returned as done.
 */
export function detectCompletedSections(
	specDocument: string | null | undefined
): Set<string> {
	if (!specDocument) return new Set();
	const completed = new Set<string>();

	const sections = extractSpecSections(specDocument);
	for (const section of sections) {
		const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(
			`##\\s+[^\\n]*${escaped}[^\\n]*\\n([\\s\\S]*?)(?=\\n##|$)`,
			'i'
		);
		const match = specDocument.match(regex);
		if (match && match[1].trim().length > 20) {
			completed.add(section);
		}
	}
	return completed;
}

// Legacy exports kept for backward compatibility — no longer used for spec generation
// but may be referenced in older UI code
export const SPEC_SECTIONS = [
	'Overview',
	'Goals',
	'User Stories',
	'Functional Requirements',
	'Non-Functional Requirements',
	'Technical Architecture',
	'Data Models',
	'API Design',
	'Implementation Plan'
] as const;

export type SpecSection = (typeof SPEC_SECTIONS)[number];

export const SECTION_LABELS: Record<SpecSection, string> = {
	'Overview': 'Overview',
	'Goals': 'Goals & Scope',
	'User Stories': 'Who Uses It & How',
	'Functional Requirements': 'What It Does',
	'Non-Functional Requirements': 'Performance & Security',
	'Technical Architecture': 'Technical Design',
	'Data Models': 'Data Structure',
	'API Design': 'Integrations',
	'Implementation Plan': 'Delivery Plan'
};
