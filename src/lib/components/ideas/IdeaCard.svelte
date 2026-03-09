<script lang="ts">
	import { base } from '$app/paths';
	import { Badge, Card, ScoreBar } from '$lib/components/ui';
	import type { IdeaSummary, DepartmentCategory, IdeaStatus } from '$lib/types';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS } from '$lib/types';
	
	interface Props {
		idea: IdeaSummary;
		showVote?: boolean;
	}
	
	let { idea, showVote = true }: Props = $props();
	let loading = $state(false);
	
	let localVoteDelta = $state(0);
	let localHasVotedOverride = $state<boolean | null>(null);
	
	let currentVoteCount = $derived(Math.max(0, (Number(idea.voteCount) || 0) + localVoteDelta));
	let currentHasVoted = $derived(localHasVotedOverride !== null ? localHasVotedOverride : Boolean(idea.hasVoted));
	
	function getDepartmentGradient(department: string): string {
		const gradients: Record<string, string> = {
			'rd': 'from-purple-600/20 to-purple-900/20',
			'production': 'from-amber-600/20 to-amber-900/20',
			'hr': 'from-pink-600/20 to-pink-900/20',
			'legal': 'from-indigo-600/20 to-indigo-900/20',
			'finance': 'from-emerald-600/20 to-emerald-900/20',
			'it': 'from-cyan-600/20 to-cyan-900/20',
			'purchasing': 'from-red-600/20 to-red-900/20',
			'quality': 'from-lime-600/20 to-lime-900/20',
			'logistics': 'from-orange-600/20 to-orange-900/20',
			'general': 'from-gray-600/20 to-gray-900/20'
		};
		return gradients[department] || 'from-gray-600/20 to-gray-900/20';
	}
	
	function getStatusLabel(status: IdeaStatus): string {
		const labels: Record<IdeaStatus, string> = {
			'draft': 'Draft',
			'evaluated': 'Evaluated',
			'realized': 'Realized',
			'published': 'Published',
			'archived': 'Archived'
		};
		return labels[status] || status;
	}
	
	function getStatusColor(status: IdeaStatus): string {
		const colors: Record<IdeaStatus, string> = {
			'draft': 'bg-bg-hover text-text-muted border-border',
			'evaluated': 'bg-warning/20 text-warning border-warning/30',
			'realized': 'bg-primary/20 text-primary border-primary/30',
			'published': 'bg-success/20 text-success border-success/30',
			'archived': 'bg-bg-hover text-text-muted border-border'
		};
		return colors[status] || 'bg-bg-hover text-text-muted border-border';
	}
	
	async function toggleVote(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		
		loading = true;
		const wasVoted = currentHasVoted;
		
		try {
			const response = await fetch(`${base}/api/ideas/${idea.id}/vote`, {
				method: wasVoted ? 'DELETE' : 'POST',
				headers: {
					'Content-Type': 'application/json'
				}
			});
			
			if (response.ok) {
				if (wasVoted) {
					localHasVotedOverride = false;
					localVoteDelta--;
				} else {
					localHasVotedOverride = true;
					localVoteDelta++;
				}
			} else if (response.status === 401) {
				window.location.href = `${base}/auth/login`;
			} else if (response.status === 400) {
				localHasVotedOverride = true;
			} else if (response.status === 404) {
				localHasVotedOverride = false;
			}
		} catch (error) {
			console.error('Vote failed:', error);
		} finally {
			loading = false;
		}
	}
</script>

<Card variant="interactive" padding="none" class="group overflow-hidden">
	<a href="{base}/ideas/{idea.slug}" class="block">
		<!-- Department gradient header -->
		<div class="relative h-24 bg-gradient-to-br {getDepartmentGradient(idea.department)} overflow-hidden">
			<div class="absolute inset-0 flex items-center justify-center">
				<svg class="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
				</svg>
			</div>
			
			<!-- Department badge -->
			<div class="absolute top-3 left-3">
				<span 
					class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs"
					style="background-color: {DEPARTMENT_COLORS[idea.department]}20; color: {DEPARTMENT_COLORS[idea.department]}; border-color: {DEPARTMENT_COLORS[idea.department]}40"
				>
					{DEPARTMENT_LABELS[idea.department] || idea.department}
				</span>
			</div>
			
			<!-- Status badge -->
			<div class="absolute top-3 right-3">
				<span class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs {getStatusColor(idea.status)}">
					{getStatusLabel(idea.status)}
				</span>
			</div>
			
		<!-- Rank badge -->
		{#if idea.rank !== null}
			<div class="absolute bottom-3 right-3">
				<span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/30 text-primary text-sm font-bold border border-primary/40">
					#{idea.rank}
				</span>
			</div>
		{/if}

		<!-- Source badge (Jira / User) -->
		{#if idea.source === 'jira'}
			<div class="absolute bottom-3 left-3">
				<span class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
					Jira
				</span>
			</div>
		{:else if idea.source === 'user'}
			<div class="absolute bottom-3 left-3">
				<span class="inline-flex items-center gap-1 rounded-full border font-medium px-2 py-0.5 text-xs bg-primary/20 text-primary border-primary/30">
					<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
					</svg>
					User
				</span>
			</div>
		{/if}
	</div>
		
		<!-- Content -->
		<div class="p-5">
			<!-- Title -->
			<h3 class="text-lg font-semibold text-text-primary mb-2 group-hover:text-primary transition-colors line-clamp-2">
				{idea.title}
			</h3>
			
			<!-- Summary -->
			<p class="text-sm text-text-secondary line-clamp-2 mb-4">
				{idea.summary}
			</p>
			
			<!-- Evaluation score -->
			{#if idea.evaluationScore !== null}
				<div class="mb-4">
					<ScoreBar label="Evaluation Score" value={idea.evaluationScore} />
				</div>
			{/if}
		</div>
	</a>
	
	<!-- Vote section (outside link) -->
	{#if showVote}
		<div class="px-5 pb-5 flex items-center justify-between border-t border-border pt-4">
			<button
				onclick={toggleVote}
				disabled={loading}
				aria-label={currentHasVoted ? 'Remove vote' : 'Vote for this idea'}
				title={currentHasVoted ? 'Click to remove your vote' : 'Click to vote'}
				class="inline-flex items-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 px-3 py-1.5 text-sm
					{currentHasVoted 
						? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30' 
						: 'bg-bg-hover text-text-secondary border border-border hover:border-primary hover:text-primary'}"
			>
				{#if loading}
					<svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
				{:else}
					<svg class="w-4 h-4" fill={currentHasVoted ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
					</svg>
				{/if}
				<span>{currentVoteCount}</span>
			</button>
			<span class="text-sm text-text-muted">
				View Details &rarr;
			</span>
		</div>
	{/if}
</Card>
