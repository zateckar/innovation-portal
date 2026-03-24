<script lang="ts">
	import { detectCompletedSections, SPEC_SECTIONS, SECTION_LABELS } from '$lib/utils/specSections';

	interface Props {
		specDocument: string | null | undefined;
		compact?: boolean;
	}

	let { specDocument, compact = false }: Props = $props();

	let completed = $derived(detectCompletedSections(specDocument));
	let count = $derived(completed.size);
	const total = SPEC_SECTIONS.length;
	let pct = $derived(Math.round((count / total) * 100));
</script>

{#if compact}
	<div class="flex items-center gap-2">
		<div class="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
			<div
				class="h-full rounded-full transition-all duration-500 {count === total ? 'bg-emerald-400' : 'bg-violet-400'}"
				style="width: {pct}%"
			></div>
		</div>
		<span class="text-xs text-white/50 tabular-nums shrink-0">{count}/{total} sections</span>
	</div>
{:else}
	<div class="space-y-3">
		<div class="flex items-center justify-between">
			<span class="text-sm font-medium text-white/70">Specification Progress</span>
			<span class="text-sm font-semibold {count === total ? 'text-emerald-400' : 'text-violet-400'}">
				{count}/{total} sections complete
			</span>
		</div>
		<div class="h-2 rounded-full bg-white/10 overflow-hidden">
			<div
				class="h-full rounded-full transition-all duration-700 {count === total ? 'bg-emerald-400' : 'bg-violet-400'}"
				style="width: {pct}%"
			></div>
		</div>
		<div class="flex flex-wrap gap-2">
			{#each SPEC_SECTIONS as section}
				{@const done = completed.has(section)}
				<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
					{done
						? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
						: 'bg-white/5 text-white/40 border border-white/10'}">
					{#if done}
						<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					{:else}
						<span class="w-1.5 h-1.5 rounded-full bg-white/30"></span>
					{/if}
					{SECTION_LABELS[section]}
				</span>
			{/each}
		</div>
	</div>
{/if}
