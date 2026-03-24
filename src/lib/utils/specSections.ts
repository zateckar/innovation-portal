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

/**
 * Business-friendly labels — avoids IT jargon for non-technical audience.
 */
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

/**
 * Returns which spec sections are present and non-empty in the given Markdown document.
 * A section is "complete" if a ## heading containing the section name exists and is followed
 * by at least 20 characters of content.
 */
export function detectCompletedSections(specDocument: string | null | undefined): Set<SpecSection> {
	if (!specDocument) return new Set();
	const completed = new Set<SpecSection>();
	for (const section of SPEC_SECTIONS) {
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
