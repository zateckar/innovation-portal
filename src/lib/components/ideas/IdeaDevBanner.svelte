<script lang="ts">
	interface Props {
		voteCount: number;
		threshold: number;
		specStatus: 'not_started' | 'in_progress' | 'completed';
	}
	let { voteCount, threshold, specStatus }: Props = $props();
</script>

{#if specStatus === 'in_progress'}
	<div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-start gap-4">
		<div class="shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
			<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>
		</div>
		<div>
			<h3 class="font-semibold text-amber-300 mb-1">In Development</h3>
			<p class="text-sm text-amber-200/80">
				This idea has been selected for development based on community votes ({voteCount}/{threshold}).
				Join the conversation below to help shape the specification.
			</p>
		</div>
	</div>
{:else if specStatus === 'completed'}
	<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex items-start gap-4">
		<div class="shrink-0 w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
			<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
			</svg>
		</div>
		<div>
			<h3 class="font-semibold text-emerald-300 mb-1">Specification Complete</h3>
			<p class="text-sm text-emerald-200/80">
				The refinement conversation is complete and a specification document has been generated,
				submitted to Azure DevOps, and linked to a Jira issue. See the specification below.
			</p>
		</div>
	</div>
{/if}
