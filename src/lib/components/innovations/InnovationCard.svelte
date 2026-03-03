<script lang="ts">
	import { base } from '$app/paths';
	import { Badge, Card, ScoreBar } from '$lib/components/ui';
	import type { InnovationSummary } from '$lib/types';
	import { CATEGORY_LABELS } from '$lib/types';
	import VoteButton from './VoteButton.svelte';
	
	interface Props {
		innovation: InnovationSummary;
		showVote?: boolean;
	}
	
	let { innovation, showVote = true }: Props = $props();
	
	function getCategoryGradient(category: string): string {
		const gradients: Record<string, string> = {
			'ai-ml': 'from-purple-600/20 to-purple-900/20',
			'devops': 'from-cyan-600/20 to-cyan-900/20',
			'security': 'from-red-600/20 to-red-900/20',
			'data-analytics': 'from-amber-600/20 to-amber-900/20',
			'developer-tools': 'from-emerald-600/20 to-emerald-900/20',
			'automation': 'from-pink-600/20 to-pink-900/20',
			'collaboration': 'from-indigo-600/20 to-indigo-900/20',
			'infrastructure': 'from-lime-600/20 to-lime-900/20'
		};
		return gradients[category] || 'from-gray-600/20 to-gray-900/20';
	}
</script>

<Card variant="interactive" padding="none" class="group overflow-hidden">
	<a href="{base}/innovations/{innovation.slug}" class="block">
		<!-- Hero image or gradient -->
		<div class="relative h-40 bg-gradient-to-br {getCategoryGradient(innovation.category)} overflow-hidden">
			{#if innovation.heroImageUrl}
				<img 
					src={innovation.heroImageUrl} 
					alt={innovation.title}
					class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
				/>
			{:else}
				<div class="absolute inset-0 flex items-center justify-center">
					<svg class="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
				</div>
			{/if}
			
			<!-- Category badge overlay -->
			<div class="absolute top-3 left-3">
				<Badge variant="category" category={innovation.category}>
					{CATEGORY_LABELS[innovation.category]}
				</Badge>
			</div>
		</div>
		
		<!-- Content -->
		<div class="p-5">
			<!-- Badges -->
			<div class="flex flex-wrap gap-2 mb-3">
				{#if innovation.hasAiComponent}
					<Badge variant="ai">AI</Badge>
				{/if}
				{#if innovation.isOpenSource}
					<Badge variant="oss">OSS</Badge>
				{/if}
				{#if innovation.isSelfHosted}
					<Badge variant="selfhost">Self-Host</Badge>
				{/if}
				{#if innovation.maturityLevel}
					<Badge>
						{innovation.maturityLevel.charAt(0).toUpperCase() + innovation.maturityLevel.slice(1)}
					</Badge>
				{/if}
			</div>
			
			<!-- Title -->
			<h3 class="text-lg font-semibold text-text-primary mb-2 group-hover:text-primary transition-colors line-clamp-1">
				{innovation.title}
			</h3>
			
			<!-- Tagline -->
			<p class="text-sm text-text-secondary line-clamp-2 mb-4">
				{innovation.tagline}
			</p>
			
			<!-- Scores -->
			<div class="grid grid-cols-2 gap-3 mb-4">
				{#if innovation.relevanceScore !== null}
					<ScoreBar label="Relevance" value={innovation.relevanceScore} />
				{/if}
				{#if innovation.actionabilityScore !== null}
					<ScoreBar label="Actionability" value={innovation.actionabilityScore} />
				{/if}
			</div>
		</div>
	</a>
	
	<!-- Vote section (outside link) -->
	{#if showVote}
		<div class="px-5 pb-5 pt-0 flex items-center justify-between border-t border-border mt-0 pt-4">
			<VoteButton 
				innovationId={innovation.id} 
				voteCount={innovation.voteCount} 
				hasVoted={innovation.hasVoted}
			/>
			<span class="text-sm text-text-muted">
				View Details →
			</span>
		</div>
	{/if}
</Card>
