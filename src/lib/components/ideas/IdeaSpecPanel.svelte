<script lang="ts">
	import { untrack } from 'svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import SpecSectionEditPanel from './SpecSectionEditPanel.svelte';
	import SpecVersionHistory from './SpecVersionHistory.svelte';

	interface Props {
		ideaId: string;
		specDocument: string;
		specReviewStatus: 'not_ready' | 'under_review' | 'published';
		hasParticipated: boolean;
		adoPrUrl: string | null;
		jiraEscalationKey: string | null;
		jiraWebHostname: string | null;
	}

	let {
		ideaId,
		specDocument,
		specReviewStatus,
		hasParticipated,
		adoPrUrl,
		jiraEscalationKey,
		jiraWebHostname
	}: Props = $props();

	// untrack: we intentionally seed from the prop once on mount, not reactively.
	let currentSpec = $state(untrack(() => specDocument));
	let activeSectionEdit = $state<string | null>(null);

	// Split the spec Markdown into sections by ## headings for per-section edit buttons
	let specSections = $derived(parseSpecSections(currentSpec));

	function parseSpecSections(doc: string): Array<{ heading: string; content: string; sectionKey: string | null }> {
		const parts = doc.split(/^(##\s+.+)$/m);
		const sections: Array<{ heading: string; content: string; sectionKey: string | null }> = [];
		if (parts[0].trim()) {
			sections.push({ heading: '', content: parts[0], sectionKey: null });
		}
		for (let i = 1; i < parts.length; i += 2) {
			const heading = parts[i];
			const content = parts[i + 1] ?? '';
			const sectionKey = heading.replace(/^##\s+(?:\d+\.\s+)?/, '').trim() || null;
			sections.push({ heading, content, sectionKey });
		}
		return sections;
	}

	function downloadSpec() {
		window.location.href = `/api/ideas/${ideaId}/spec-download`;
	}
</script>

<div class="rounded-2xl border border-white/10 bg-bg-elevated overflow-hidden">

	<!-- Header -->
	<div class="flex items-center justify-between px-5 py-4 border-b border-white/10">
		<div class="flex items-center gap-2">
			<svg class="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			<h2 class="font-semibold text-white">Specification Document</h2>
		</div>
		<div class="flex items-center gap-2 flex-wrap justify-end">
			{#if adoPrUrl}
				<a href={adoPrUrl} target="_blank" rel="noopener noreferrer"
					class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition-colors">
					Azure DevOps PR &#8599;
				</a>
			{/if}
			{#if jiraEscalationKey && jiraWebHostname}
				<a href="{jiraWebHostname}/browse/{jiraEscalationKey}" target="_blank" rel="noopener noreferrer"
					class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors">
					{jiraEscalationKey} &#8599;
				</a>
			{/if}
			<button onclick={downloadSpec}
				class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 transition-colors">
				Download .md
			</button>
		</div>
	</div>

	<!-- Spec body — section-by-section with per-section AI edit buttons -->
	<div class="max-h-[800px] overflow-y-auto px-6 py-5 space-y-0 spec-body">
		{#each specSections as section}
			<div>
				{#if section.heading}
					<div class="flex items-start gap-3 mt-8 mb-3 first:mt-0">
						<div class="flex-1 spec-section-heading">
							{@html renderMarkdown(section.heading)}
						</div>
						{#if section.sectionKey}
							{#if activeSectionEdit === section.sectionKey}
								<button
									onclick={() => activeSectionEdit = null}
									class="shrink-0 mt-1 text-xs text-violet-400/70 px-2.5 py-1 rounded-md
										border border-violet-500/20 hover:border-violet-500/40 transition-all whitespace-nowrap"
								>
									Cancel
								</button>
							{:else}
								<button
									onclick={() => activeSectionEdit = section.sectionKey}
									class="shrink-0 mt-1 text-xs text-violet-400 px-2.5 py-1 rounded-md
										border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 transition-all whitespace-nowrap"
								>
									Ask AI to revise
								</button>
							{/if}
						{/if}
					</div>

					{#if activeSectionEdit === section.sectionKey && section.sectionKey}
						<div class="mb-4">
							<SpecSectionEditPanel
								{ideaId}
								sectionName={section.sectionKey}
								onUpdated={(newSpec) => { currentSpec = newSpec; activeSectionEdit = null; }}
								onClose={() => activeSectionEdit = null}
							/>
						</div>
					{/if}
				{/if}

				<div class="spec-section-content">
					{@html renderMarkdown(section.content || '')}
				</div>
			</div>
		{/each}
	</div>

	<!-- Version history -->
	<div class="px-5 pb-5 pt-2 border-t border-white/10 space-y-2">
		<SpecVersionHistory
			{ideaId}
			currentSpec={currentSpec}
			{hasParticipated}
			onRolledBack={(restoredSpec) => { currentSpec = restoredSpec; }}
		/>
	</div>

</div>

<style>
	/* ── Spec Document Styling ────────────────────────────────────────────── */

	/* Title heading (# H1) */
	:global(.spec-body h1) {
		font-size: 1.5rem;
		font-weight: 700;
		color: #ffffff;
		margin-bottom: 0.5rem;
		line-height: 1.3;
	}

	/* Section headings (## H2) */
	:global(.spec-section-heading h2) {
		font-size: 1.125rem;
		font-weight: 600;
		color: #e2e8f0;
		margin: 0;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(255,255,255,0.08);
		line-height: 1.4;
	}

	/* Sub-headings (### H3) inside section content */
	:global(.spec-section-content h3) {
		font-size: 0.9375rem;
		font-weight: 600;
		color: #cbd5e1;
		margin-top: 1.25rem;
		margin-bottom: 0.5rem;
	}

	/* Paragraphs */
	:global(.spec-section-content p) {
		font-size: 0.875rem;
		color: #94a3b8;
		line-height: 1.7;
		margin-bottom: 0.75rem;
	}

	/* Unordered lists */
	:global(.spec-section-content ul) {
		margin: 0.5rem 0 0.75rem 0;
		padding-left: 1.25rem;
		list-style-type: disc;
	}

	/* Ordered lists */
	:global(.spec-section-content ol) {
		margin: 0.5rem 0 0.75rem 0;
		padding-left: 1.25rem;
		list-style-type: decimal;
	}

	:global(.spec-section-content li) {
		font-size: 0.875rem;
		color: #94a3b8;
		line-height: 1.6;
		margin-bottom: 0.375rem;
	}

	/* Bold text */
	:global(.spec-section-content strong) {
		color: #e2e8f0;
		font-weight: 600;
	}

	/* Inline code */
	:global(.spec-section-content code) {
		font-size: 0.8125rem;
		color: #67e8f9;
		background: rgba(103, 232, 249, 0.08);
		border: 1px solid rgba(103, 232, 249, 0.15);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-family: monospace;
	}

	/* Tables */
	:global(.spec-section-content table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
		margin: 0.75rem 0;
	}

	:global(.spec-section-content th) {
		text-align: left;
		font-weight: 600;
		color: #cbd5e1;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 0.5rem 0.75rem;
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(255,255,255,0.08);
	}

	:global(.spec-section-content td) {
		padding: 0.5rem 0.75rem;
		color: #94a3b8;
		border: 1px solid rgba(255,255,255,0.06);
		vertical-align: top;
		line-height: 1.5;
	}

	:global(.spec-section-content tr:nth-child(even) td) {
		background: rgba(255,255,255,0.02);
	}

	/* Blockquotes */
	:global(.spec-section-content blockquote) {
		border-left: 3px solid rgba(139, 92, 246, 0.4);
		padding: 0.5rem 1rem;
		margin: 0.75rem 0;
		color: #94a3b8;
		background: rgba(139, 92, 246, 0.04);
		border-radius: 0 0.25rem 0.25rem 0;
		font-style: italic;
	}

	/* Horizontal rule */
	:global(.spec-section-content hr) {
		border: none;
		border-top: 1px solid rgba(255,255,255,0.08);
		margin: 1rem 0;
	}
</style>
