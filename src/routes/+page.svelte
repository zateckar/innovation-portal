<script lang="ts">
	import { base } from '$app/paths';
	import { InnovationCard } from '$lib/components/innovations';
	import { CatalogCard } from '$lib/components/catalog';
	import { Badge, Card } from '$lib/components/ui';
	import { CATEGORY_LABELS, type InnovationCategory } from '$lib/types';
	import RadarVisualization from '$lib/components/innovations/RadarVisualization.svelte';
	
	let { data } = $props();
	
	const categories = Object.entries(CATEGORY_LABELS) as [InnovationCategory, string][];
</script>

<svelte:head>
	<title>Innovation Radar - Discover the Future</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Hero Section -->
	<section class="text-center mb-12">
		<h1 class="text-4xl md:text-5xl font-bold mb-4">
			<span class="gradient-text">Innovation Radar</span>
		</h1>
		<p class="text-xl text-text-secondary max-w-2xl mx-auto">
			Discover, evaluate, and vote for the technologies that will shape our future.
			AI-powered insights meet collective intelligence.
		</p>
	</section>
	
	<!-- Radar Visualization -->
	<section class="mb-12">
		<Card padding="lg" class="overflow-hidden">
			<RadarVisualization innovations={data.innovations} />
		</Card>
	</section>
	
	<!-- Two Paths Explanation -->
	<section class="mb-12">
		<Card class="bg-gradient-to-r from-violet-500/5 via-transparent to-emerald-500/5 border-zinc-800">
			<div class="p-6 md:p-8">
				<div class="grid md:grid-cols-2 gap-8">
					<!-- Innovation Radar -->
					<div class="space-y-4">
						<div class="flex items-center gap-3">
							<div class="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
								<svg class="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
								</svg>
							</div>
							<div>
								<h3 class="text-lg font-semibold text-white">Innovation Radar</h3>
								<p class="text-sm text-violet-400">Discover & Vote</p>
							</div>
						</div>
						<p class="text-zinc-400 text-sm">
							Explore AI-curated innovations, research insights, and vote for the technologies you want to see implemented. 
							Your votes help prioritize what gets built next.
						</p>
					<a href="{base}/innovations" class="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors">
						Browse innovations
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
							</svg>
						</a>
					</div>

					<!-- Incubator Catalog -->
					<div class="space-y-4">
						<div class="flex items-center gap-3">
							<div class="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
								<svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
								</svg>
							</div>
							<div>
								<h3 class="text-lg font-semibold text-white">Incubator Catalog</h3>
								<p class="text-sm text-emerald-400">Try it Now</p>
							</div>
						</div>
						<p class="text-zinc-400 text-sm">
							Ready-to-use implementations promoted from the radar. These innovations have been built and deployed 
							so you can try them yourself.
						</p>
					<a href="{base}/catalog" class="inline-flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
						Explore catalog
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
							</svg>
						</a>
					</div>
				</div>

				<!-- Flow arrow for larger screens -->
				<div class="hidden md:flex justify-center mt-6">
					<div class="flex items-center gap-4 px-6 py-3 rounded-full bg-zinc-800/50 border border-zinc-700">
						<span class="text-sm text-violet-400 font-medium">Discover</span>
						<svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
						</svg>
						<span class="text-sm text-zinc-400">Vote</span>
						<svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
						</svg>
						<span class="text-sm text-zinc-400">Promote</span>
						<svg class="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
						</svg>
						<span class="text-sm text-emerald-400 font-medium">Try</span>
					</div>
				</div>
			</div>
		</Card>
	</section>

	<!-- Incubator Catalog Showcase -->
	{#if data.catalogItems && data.catalogItems.length > 0}
		<section class="mb-12">
			<div class="flex items-center justify-between mb-6">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
						</svg>
					</div>
					<h2 class="text-2xl font-bold text-white">Ready to Try</h2>
				</div>
			<a href="{base}/catalog" class="text-emerald-400 hover:text-emerald-300 text-sm transition-colors">
				View all →
			</a>
			</div>
			
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{#each data.catalogItems as item (item.id)}
					<div class="animate-fade-in">
						<CatalogCard {item} />
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Category Quick Links -->
	<section class="mb-12">
		<div class="flex flex-wrap justify-center gap-3">
			{#each categories as [category, label]}
			<a 
				href="{base}/innovations?category={category}"
				class="group"
			>
					<Badge variant="category" category={category} size="md">
						{label}
						{#if data.categoryCounts[category]}
							<span class="ml-1.5 opacity-60">({data.categoryCounts[category]})</span>
						{/if}
					</Badge>
				</a>
			{/each}
		</div>
	</section>
	
	<!-- Featured Innovations -->
	{#if data.innovations.length > 0}
		<section>
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-text-primary">Top Innovations</h2>
			<a href="{base}/innovations" class="text-primary hover:underline text-sm">
				View all →
			</a>
			</div>
			
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{#each data.innovations as innovation (innovation.id)}
					<div class="animate-fade-in">
						<InnovationCard {innovation} />
					</div>
				{/each}
			</div>
		</section>
	{:else}
		<section class="text-center py-16">
			<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-bg-elevated flex items-center justify-center">
				<svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-text-primary mb-2">No innovations yet</h2>
			<p class="text-text-secondary mb-6">
				Be the first to propose an innovation or wait for the AI scanner to discover new trends.
			</p>
		<a 
			href="{base}/propose"
			class="inline-flex items-center px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-primary-hover text-white font-medium hover:opacity-90 transition-opacity"
		>
				Propose Innovation
			</a>
		</section>
	{/if}
</div>
