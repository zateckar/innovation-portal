import { readFileSync } from 'fs';
import { resolve } from 'path';

const SPEC_TEMPLATE = readFileSync(resolve(import.meta.dirname, 'spec-template.md'), 'utf-8');

// ────────────────────────────────────────────────────────────────
// Spec Validation
// ────────────────────────────────────────────────────────────────

interface ValidationResult {
	valid: boolean;
	missing: string[];
}

/**
 * Verify a specification has all required sections with real content.
 * Section headings use business-friendly language, not developer jargon.
 * Validation error messages are written for non-technical users.
 */
export function validateSpec(specContent: string): ValidationResult {
	const required = [
		{
			section: 'What is this application?',
			pattern: /##\s*1\.\s*What is this application/i,
			minLength: 50,
			userMessage: 'Please describe what the application does and why it is needed.'
		},
		{
			section: 'Who will use it?',
			pattern: /##\s*2\.\s*Who will use it/i,
			minLength: 30,
			userMessage:
				'Please describe who will use the application and what they need to do.'
		},
		{
			section: 'What information does it work with?',
			pattern: /##\s*3\.\s*What information/i,
			minLength: 50,
			userMessage:
				'Please describe the things the application keeps track of (requests, tasks, items, etc.).'
		},
		{
			section: 'What should the application do?',
			pattern: /##\s*4\.\s*What should the application do/i,
			minLength: 100,
			userMessage:
				'Please describe the features — what can users do, and what happens when they do it?'
		},
		{
			section: 'What screens does it need?',
			pattern: /##\s*5\.\s*What screens/i,
			minLength: 50,
			userMessage:
				'Please describe what screens (pages) the application needs and what users see on each one.'
		},
		{
			section: 'Business rules and constraints',
			pattern: /##\s*6\.\s*Business rules/i,
			minLength: 20,
			userMessage:
				'Please add any rules the application must enforce (e.g., "a title cannot be empty").'
		}
	];

	const missing: string[] = [];

	for (const req of required) {
		const match = specContent.match(req.pattern);
		if (!match) {
			missing.push(req.userMessage);
			continue;
		}
		// Check section has content (count chars until next ## or EOF)
		const startIdx = match.index! + match[0].length;
		const nextSection = specContent.indexOf('\n## ', startIdx);
		const sectionContent =
			nextSection > 0
				? specContent.slice(startIdx, nextSection).trim()
				: specContent.slice(startIdx).trim();
		if (sectionContent.length < req.minLength) {
			missing.push(`${req.section}: needs more detail. ${req.userMessage}`);
		}
	}

	// Check that features have testable success criteria
	// Only count ### headings inside section 4 ("What should the application do?")
	// to avoid counting screen descriptions, metrics, assumptions, etc. as features.
	const section4Match = specContent.match(/##\s*4\.\s*What should the application do[\s\S]*?(?=\n## |\s*$)/i);
	const section4Content = section4Match ? section4Match[0] : '';
	const featureSections = section4Content.match(/###\s+.+/g) || [];
	const hasCriteria = (specContent.match(/how do we know it works/gi) || []).length;
	const featureCount = featureSections.length;

	if (featureCount > 0 && hasCriteria < featureCount) {
		missing.push(
			'Every feature requires a "How do we know it works" check. ' +
				'For each feature, describe a simple test anyone could try — for example: ' +
				'"I can add a new item and it appears in the list immediately."'
		);
	}

	return { valid: missing.length === 0, missing };
}

// ────────────────────────────────────────────────────────────────
// Interview Prompts
// ────────────────────────────────────────────────────────────────

/**
 * Generate the analysis prompt for the first interview round.
 * This examines what the user already provided and identifies gaps.
 */
export function getAnalysisPrompt(userInput: string): string {
	return `You are a friendly product consultant helping a business person
describe the application they want built. They are NOT a developer — do not use
technical jargon. Speak in plain business language.

Here is what they told you:
---
${userInput}
---

Analyze what they've told you against what we need to know:
1. What is this application? — Do we understand the purpose?
2. Who will use it? — Do we know the different types of users?
3. What information does it manage? — Do we know the "things" the app tracks?
4. What should it do? — Do we have specific features described?
5. What screens are needed? — Do we know what the user will see?
6. Business rules? — Do we know any constraints or requirements?
7. Anything else? — Mobile support, number of users, style preferences?

For each area, rate: CLEAR / NEEDS MORE DETAIL / NOT MENTIONED.

Then write questions to fill the gaps. Ask about NOT MENTIONED and NEEDS MORE DETAIL only.
Ask at most 5 questions per round. Be specific and conversational.

BAD question: "Can you elaborate on the features?"
BAD question: "What data entities does the application manage?"
GOOD question: "When someone adds a new request, what information should they fill in?
  For example: just a title, or also a description, priority level, deadline?"
GOOD question: "You mentioned managers and staff — should managers see everything,
  or only their own department's data?"

Write questions as if you're sitting across the table from a colleague.

Output format:
## What We Know So Far
| Area | Status | Notes |
|------|--------|-------|

## Questions
1. {question}
2. {question}
...`;
}

/**
 * Generate the draft prompt to create SPECIFICATION.md from collected answers.
 */
export function getDraftPrompt(userInput: string, qaTranscript: string): string {
	return `Based on the conversation below, write a complete SPECIFICATION.md.

Use this EXACT template structure — keep the language simple and non-technical.
The spec is written FOR business people, not developers.
${SPEC_TEMPLATE}

User's original idea:
---
${userInput}
---

Conversation so far:
---
${qaTranscript}
---

RULES:
- Write in plain business language. No jargon. No "routes", "endpoints", "components".
- Fill in EVERY section. If the user didn't specify something, make a reasonable default
  and mark it with "(assumed — please change if this is wrong)" so they can spot it.
- "What should the application do?" features MUST each have a "How do we know it works"
  test written as something a person (not a computer) would check.
  GOOD: "I can add a new request with just a title, and it appears in my list immediately"
  BAD: "The POST /api/requests endpoint returns 201"
- "What information does it work with?" MUST list every type of thing the app manages,
  described the way the user would describe it (not as database tables).
- "What screens are needed?" should describe what the user SEES and DOES,
  not technical page structures.
- Be SPECIFIC. "User can manage tasks" is too vague.
  "User can create a new task by typing a title and clicking Add" is good.

Write the complete SPECIFICATION.md.`;
}

/**
 * Generate the completeness check prompt.
 */
export function getCompletenessPrompt(): string {
	return `Review this SPECIFICATION.md as if you are handing it to a
colleague to check. Is there enough detail to actually build this?

Check:
1. Does every feature have a "How do we know it works" test?
   (not just "it should work" but a specific thing to try)
2. Does every screen describe what the user sees and what they can do?
3. Does "What information does it work with" cover every type of thing
   mentioned in the features?
4. Are there features that mention things not listed in the information section?
5. Are the business rules specific enough to follow?
   ("titles can't be empty" = good. "proper validation" = too vague)

If ANY gaps found, write follow-up questions in plain language.
If COMPLETE, respond with "SPECIFICATION COMPLETE — ready to build."`;
}

/**
 * Get the spec template content for use in prompts.
 */
export function getSpecTemplate(): string {
	return SPEC_TEMPLATE;
}
