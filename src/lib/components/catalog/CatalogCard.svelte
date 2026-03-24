<script lang="ts">
	import { base } from '$app/paths';
	import { Card } from '$lib/components/ui';
	import { CATEGORY_LABELS, CATEGORY_COLORS, CATALOG_STATUS_LABELS, CATALOG_STATUS_COLORS, type CatalogItemSummary } from '$lib/types';

	interface Props {
		item: CatalogItemSummary;
	}

	let { item }: Props = $props();

	const categoryGradients: Record<string, string> = {
		'ai-ml': 'from-violet-500/28 to-purple-600/28',
		'devops': 'from-cyan-500/28 to-teal-600/28',
		'security': 'from-red-500/28 to-rose-600/28',
		'data-analytics': 'from-amber-500/28 to-orange-600/28',
		'developer-tools': 'from-emerald-500/28 to-green-600/28',
		'automation': 'from-pink-500/28 to-fuchsia-600/28',
		'collaboration': 'from-indigo-500/28 to-blue-600/28',
		'infrastructure': 'from-lime-500/28 to-green-600/28'
	};
</script>

<a href="{base}/catalog/{item.slug}" class="group block">
	<Card variant="interactive" padding="none" class="h-full overflow-hidden">
		<!-- Hero area with icon or gradient -->
		<div class="relative h-32 bg-gradient-to-br {categoryGradients[item.category]} flex items-center justify-center">
			{#if item.iconUrl}
				<img 
					src={item.iconUrl} 
					alt={item.name}
					class="w-16 h-16 object-contain rounded-lg shadow-lg"
				/>
			{:else}
				<div class="w-16 h-16 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
					<svg class="w-8 h-8 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
					</svg>
				</div>
			{/if}
			
			<!-- Status badge -->
			{#if item.status !== 'active'}
				<div class="absolute top-2 right-2">
					<span 
						class="px-2 py-0.5 rounded-full text-xs font-medium"
						style="background-color: {CATALOG_STATUS_COLORS[item.status]}; color: white;"
					>
						{CATALOG_STATUS_LABELS[item.status]}
					</span>
				</div>
			{/if}

			<!-- "Try it" indicator -->
			<div class="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-medium">
				<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
				</svg>
				Try it
			</div>
		</div>

		<!-- Content -->
		<div class="p-4 space-y-3">
			<!-- Category -->
			<span 
				class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
				style="background-color: {CATEGORY_COLORS[item.category]}30; color: {CATEGORY_COLORS[item.category]}; border-color: {CATEGORY_COLORS[item.category]}55;"
			>
				{CATEGORY_LABELS[item.category]}
			</span>

			<!-- Title -->
			<h3 class="font-semibold text-text-primary group-hover:text-violet-300 transition-colors line-clamp-1">
				{item.name}
			</h3>

			<!-- Description -->
			<p class="text-sm text-text-secondary line-clamp-2">
				{item.description}
			</p>

			<!-- From Innovation Radar indicator -->
			{#if item.innovationId}
				<div class="flex items-center gap-1 text-xs text-violet-300">
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Promoted from Innovation Radar
				</div>
			{/if}
		</div>
	</Card>
</a>
