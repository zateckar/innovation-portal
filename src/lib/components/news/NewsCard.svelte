<script lang="ts">
	import { base } from '$app/paths';
	import { Badge, Card, ScoreBar } from '$lib/components/ui';
	import type { NewsSummary, DepartmentCategory } from '$lib/types';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS } from '$lib/types';
	
	interface Props {
		newsItem: NewsSummary;
	}
	
	let { newsItem }: Props = $props();
	
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
	
	function formatDate(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<Card variant="interactive" padding="none" class="group overflow-hidden">
	<a href="{base}/news/{newsItem.slug}" class="block">
		<!-- Category gradient header -->
		<div class="relative h-28 bg-gradient-to-br {getDepartmentGradient(newsItem.category)} overflow-hidden">
			<div class="absolute inset-0 flex items-center justify-center">
				<svg class="w-12 h-12 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
				</svg>
			</div>
			
			<!-- Department badge overlay -->
			<div class="absolute top-3 left-3">
				<span 
					class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs"
					style="background-color: {DEPARTMENT_COLORS[newsItem.category as DepartmentCategory]}20; color: {DEPARTMENT_COLORS[newsItem.category as DepartmentCategory]}; border-color: {DEPARTMENT_COLORS[newsItem.category as DepartmentCategory]}40"
				>
					{DEPARTMENT_LABELS[newsItem.category as DepartmentCategory] || newsItem.category}
				</span>
			</div>
		</div>
		
		<!-- Content -->
		<div class="p-5">
			<!-- Title -->
			<h3 class="text-lg font-semibold text-text-primary mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-primary group-hover:to-secondary transition-all line-clamp-2">
				{newsItem.title}
			</h3>
			
			<!-- Summary -->
			<p class="text-sm text-text-secondary line-clamp-2 mb-4">
				{newsItem.summary}
			</p>
			
			<!-- Relevance score -->
			{#if newsItem.relevanceScore !== null}
				<div class="mb-4">
					<ScoreBar label="Relevance" value={newsItem.relevanceScore} />
				</div>
			{/if}
			
			<!-- Footer -->
			<div class="flex items-center justify-between text-xs text-text-muted pt-3 border-t border-border">
				<span>{formatDate(newsItem.publishedAt)}</span>
				<span class="text-text-muted group-hover:text-primary transition-colors">
					Read more &rarr;
				</span>
			</div>
		</div>
	</a>
</Card>
