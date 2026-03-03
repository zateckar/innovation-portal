<script lang="ts">
	import { InnovationCard } from '$lib/components/innovations';
	import { Card } from '$lib/components/ui';
	
	let { data } = $props();
</script>

<svelte:head>
	<title>My Votes - Innovation Radar</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Header -->
	<div class="mb-8">
		<div class="flex items-center gap-3 mb-2">
			<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
				<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"></path>
				</svg>
			</div>
			<h1 class="text-3xl font-bold text-text-primary">My Votes</h1>
		</div>
		<p class="text-text-secondary">Innovations you've voted for</p>
	</div>
	
	<!-- Info Card -->
	<Card padding="md" class="mb-8 bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
		<div class="flex items-start gap-4">
			<div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
				<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
				</svg>
			</div>
			<div>
				<h3 class="font-medium text-text-primary mb-1">Your voted innovations</h3>
				<p class="text-sm text-text-secondary">
					You've voted for {data.innovations.length} innovation{data.innovations.length === 1 ? '' : 's'}. 
					Your votes help surface the most interesting technologies for the community.
				</p>
			</div>
		</div>
	</Card>
	
	<!-- Results -->
	{#if data.innovations.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
			{#each data.innovations as innovation (innovation.id)}
				<div class="animate-fade-in">
					<InnovationCard {innovation} />
				</div>
			{/each}
		</div>
	{:else}
		<div class="text-center py-16">
			<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-bg-elevated flex items-center justify-center">
				<svg class="w-10 h-10 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 15l7-7 7 7"></path>
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-text-primary mb-2">No votes yet</h2>
			<p class="text-text-secondary mb-6">
				You haven't voted for any innovations yet. Browse and vote for the technologies you find most interesting!
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
