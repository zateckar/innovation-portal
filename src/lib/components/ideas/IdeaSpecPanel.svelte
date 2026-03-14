<script lang="ts">
	import { marked } from 'marked';

	interface Props {
		specDocument: string;
		adoPrUrl: string | null;
		jiraEscalationKey: string | null;
		jiraWebHostname: string | null;
	}

	let { specDocument, adoPrUrl, jiraEscalationKey, jiraWebHostname }: Props = $props();

	const renderedSpec = $derived(marked.parse(specDocument) as string);

	function downloadSpec() {
		const blob = new Blob([specDocument], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'specification.md';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="rounded-xl border border-border bg-bg-surface overflow-hidden">
	<div class="px-5 py-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
		<div class="flex items-center gap-3">
			<div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
				<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
			</div>
			<h3 class="font-semibold text-text-primary">Specification Document</h3>
		</div>
		<div class="flex items-center gap-2 flex-wrap">
			{#if adoPrUrl}
				<a
					href={adoPrUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-colors border border-blue-500/30"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
						/>
					</svg>
					Azure DevOps PR
				</a>
			{/if}
			{#if jiraEscalationKey}
				<a
					href="{jiraWebHostname ?? ''}/browse/{jiraEscalationKey}"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-medium hover:bg-indigo-500/30 transition-colors border border-indigo-500/30"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
						/>
					</svg>
					{jiraEscalationKey}
				</a>
			{/if}
			<button
				onclick={downloadSpec}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-elevated text-text-muted text-xs font-medium hover:bg-bg-hover hover:text-text-primary transition-colors border border-border"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				Download .md
			</button>
		</div>
	</div>

	<div class="p-6 prose prose-invert prose-sm max-w-none overflow-auto max-h-[600px]">
		{@html renderedSpec}
	</div>
</div>
