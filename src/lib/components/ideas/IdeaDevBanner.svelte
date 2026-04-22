<script lang="ts">
	import { base } from '$app/paths';

	interface Props {
		voteCount: number;
		threshold: number;
		specStatus: 'not_started' | 'in_progress' | 'completed';
		specReviewStatus?: 'not_ready' | 'under_review' | 'published';
		/** Slug of the idea — used to deep-link the Join Chat button to the
		 *  refinement chat under the Development section. */
		ideaSlug: string;
	}
	let { voteCount, threshold, specStatus, specReviewStatus = 'not_ready', ideaSlug }: Props = $props();
</script>

{#if specStatus === 'in_progress'}
	<!-- Amber: refinement conversation active -->
	<div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-start gap-4">
		<div class="shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
			<svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>
		</div>
		<div class="flex-1 min-w-0">
			<h3 class="font-semibold text-amber-300 mb-1">In Development</h3>
			<p class="text-sm text-amber-200/80">
				This idea has been selected for development based on community votes ({voteCount}/{threshold}).
				Join the refinement chat to help shape the specification.
			</p>
		</div>
		<a
			href="{base}/development/{ideaSlug}"
			class="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
				bg-amber-500/20 text-amber-300 border border-amber-500/30
				hover:bg-amber-500/30 transition-colors"
		>
			<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
			</svg>
			Join Chat
		</a>
	</div>

{:else if specStatus === 'completed' && specReviewStatus === 'under_review'}
	<!-- Violet: spec drafted, waiting for participant review & publish -->
	<div class="rounded-xl border border-violet-500/30 bg-violet-500/10 p-5 flex items-start gap-4">
		<div class="shrink-0 w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
			<svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
		</div>
		<div>
			<h3 class="font-semibold text-violet-300 mb-1">Specification Ready for Review</h3>
			<p class="text-sm text-violet-200/80">
				The AI has drafted a full specification from {voteCount} community votes and the refinement conversation.
				Review the document below, suggest changes, and publish to DevOps when the team is satisfied.
			</p>
		</div>
	</div>

{:else if specStatus === 'completed'}
	<!-- Emerald: published to DevOps (specReviewStatus === 'published', or legacy completed) -->
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
