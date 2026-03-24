<script lang="ts">
	import { marked } from 'marked';
	import { SPEC_SECTIONS } from '$lib/utils/specSections';
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

	let currentSpec = $state(specDocument);
	let publishing = $state(false);
	let publishError = $state('');
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
			const sectionKey = SPEC_SECTIONS.find((s) =>
				heading.toLowerCase().includes(s.toLowerCase())
			) ?? null;
			sections.push({ heading, content, sectionKey });
		}
		return sections;
	}

	function downloadSpec() {
		const blob = new Blob([currentSpec], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'specification.md';
		a.click();
		URL.revokeObjectURL(url);
	}

	async function publishToDevOps() {
		if (publishing) return;
		publishing = true;
		publishError = '';
		try {
			const res = await fetch(`/api/ideas/${ideaId}/publish`, { method: 'POST' });
			if (!res.ok) {
				const data = await res.json().catch(() => ({})) as { message?: string };
				throw new Error(data.message ?? `Failed (${res.status})`);
			}
			// Full reload to update specReviewStatus from server
			window.location.reload();
		} catch (err) {
			publishError = err instanceof Error ? err.message : 'Failed to publish';
			publishing = false;
		}
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

	<!-- Review controls (only when under_review) -->
	{#if specReviewStatus === 'under_review'}
		<div class="flex items-center justify-between gap-4 px-5 py-3 border-b border-white/10 bg-violet-500/5">
			<p class="text-sm text-white/60">
				{#if hasParticipated}
					You helped shape this spec. Review it, suggest changes via AI, then publish when ready.
				{:else}
					Review the specification. Contribute to the discussion above to become a participant and unlock publishing.
				{/if}
			</p>
			{#if hasParticipated}
				<button
					onclick={publishToDevOps}
					disabled={publishing}
					class="shrink-0 px-4 py-2 text-sm font-semibold rounded-lg
						bg-gradient-to-r from-violet-600 to-indigo-600
						hover:from-violet-500 hover:to-indigo-500
						text-white disabled:opacity-50 transition-all whitespace-nowrap"
				>
					{publishing ? 'Publishing...' : 'Publish to DevOps \u2192'}
				</button>
			{/if}
		</div>
		{#if publishError}
			<p class="px-5 py-2 text-sm text-red-400 bg-red-500/10 border-b border-red-500/20">{publishError}</p>
		{/if}
	{/if}

	<!-- Spec body — section-by-section for per-section edit buttons -->
	<div class="max-h-[600px] overflow-y-auto px-5 py-4 space-y-0">
		{#each specSections as section}
			<div>
				{#if section.heading}
					<div class="flex items-baseline gap-3 group mt-6 mb-1 first:mt-0">
						<div class="flex-1 prose prose-invert prose-sm max-w-none">
							{@html marked.parse(section.heading)}
						</div>
						{#if specReviewStatus === 'under_review' && section.sectionKey}
							{#if activeSectionEdit === section.sectionKey}
								<button
									onclick={() => activeSectionEdit = null}
									class="shrink-0 opacity-0 group-hover:opacity-100 text-xs text-violet-400/70 px-2 py-0.5 rounded
										border border-violet-500/20 hover:border-violet-500/40 transition-all"
								>
									Cancel
								</button>
							{:else}
								<button
									onclick={() => activeSectionEdit = section.sectionKey}
									class="shrink-0 opacity-0 group-hover:opacity-100 text-xs text-violet-400 px-2 py-0.5 rounded
										border border-violet-500/30 bg-violet-500/10 hover:bg-violet-500/20 transition-all"
								>
									Ask AI to revise
								</button>
							{/if}
						{/if}
					</div>

					{#if activeSectionEdit === section.sectionKey && section.sectionKey}
						<div class="mb-3">
							<SpecSectionEditPanel
								{ideaId}
								sectionName={section.sectionKey}
								onUpdated={(newSpec) => { currentSpec = newSpec; activeSectionEdit = null; }}
								onClose={() => activeSectionEdit = null}
							/>
						</div>
					{/if}
				{/if}

				<div class="prose prose-invert prose-sm max-w-none">
					{@html marked.parse(section.content || '')}
				</div>
			</div>
		{/each}
	</div>

	<!-- Version history (only when under_review) -->
	{#if specReviewStatus === 'under_review'}
		<div class="px-5 pb-5 pt-2 border-t border-white/10 space-y-2">
			<SpecVersionHistory
				{ideaId}
				currentSpec={currentSpec}
				{hasParticipated}
				onRolledBack={(restoredSpec) => { currentSpec = restoredSpec; }}
			/>
		</div>
	{/if}

</div>
