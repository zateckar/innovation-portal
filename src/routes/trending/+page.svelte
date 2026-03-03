<script lang="ts">
	import { InnovationCard } from '$lib/components/innovations';
	import { Card } from '$lib/components/ui';
	
	let { data } = $props();
</script>

<svelte:head>
	<title>Trending Innovations - Innovation Radar</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center gap-3 mb-2">
			<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
				<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"></path>
				</svg>
			</div>
			<h1 class="text-3xl font-bold text-text-primary">Trending</h1>
		</div>
		<p class="text-text-secondary">Innovations gaining the most attention this week</p>
	</div>
	
	<!-- Info Card -->
	<Card padding="md" class="mb-8 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/20">
		<div class="flex items-start gap-4">
			<div class="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
				<svg class="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
				</svg>
			</div>
			<div>
				<h3 class="font-medium text-text-primary mb-1">How trending works</h3>
				<p class="text-sm text-text-secondary">
					Trending innovations are ranked by votes received in the last 7 days. 
					This helps surface new and exciting technologies that the community is currently excited about.
				</p>
			</div>
		</div>
	</Card>
	
	<!-- Results -->
	{#if data.innovations.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each data.innovations as innovation, i (innovation.id)}
				<div class="animate-fade-in relative">
					{#if i < 3}
						<div class="absolute -top-2 -left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
							{i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900' : ''}
							{i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-700' : ''}
							{i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900' : ''}"
						>
							{i + 1}
						</div>
					{/if}
					<InnovationCard {innovation} />
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-16">
			<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-bg-elevated flex items-center justify-center">
				<svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"></path>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-text-primary mb-2">No trending innovations yet</h2>
			<p class="text-text-secondary mb-6">
				Be the first to vote on innovations and start the trends!
			</p>
			<a 
				href="/innovations"
				class="inline-flex px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
			>
				Browse Innovations
			</a>
		</div>
	{/if}
</div>
