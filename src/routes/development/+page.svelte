<script lang="ts">
	import DevelopmentIdeaCard from '$lib/components/ideas/DevelopmentIdeaCard.svelte';

	let { data } = $props();

	type Tab = 'in_progress' | 'building' | 'deployed';
	let activeTab = $state<Tab>('in_progress');

	// Merge underReview into inProgress — there's no separate review stage
	let allInProgress = $derived([...data.inProgress, ...data.underReview]);

	let displayedIdeas = $derived(
		activeTab === 'in_progress' ? allInProgress :
		activeTab === 'building' ? data.building :
		data.deployed
	);

	const tabs: Array<{ key: Tab; label: string; color: string; bgActive: string; badgeBg: string }> = [
		{ key: 'in_progress', label: 'In Progress', color: 'text-amber-300', bgActive: 'bg-amber-500/20', badgeBg: 'bg-amber-500/30 text-amber-200' },
		{ key: 'building', label: 'Building', color: 'text-sky-300', bgActive: 'bg-sky-500/20', badgeBg: 'bg-sky-500/30 text-sky-200' },
		{ key: 'deployed', label: 'Deployed', color: 'text-emerald-300', bgActive: 'bg-emerald-500/20', badgeBg: 'bg-emerald-500/30 text-emerald-200' },
	];

	function getCount(key: Tab): number {
		if (key === 'in_progress') return allInProgress.length;
		if (key === 'building') return data.building.length;
		return data.deployed.length;
	}

	const emptyStates: Record<Tab, { icon: string; title: string; subtitle: string }> = {
		in_progress: { icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z', title: 'No ideas in active development', subtitle: 'Ideas reach this stage when enough community members vote for them.' },
		building: { icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z', title: 'No applications currently building', subtitle: 'Applications appear here during the autonomous AI build process.' },
		deployed: { icon: 'M5 13l4 4L19 7', title: 'No deployed applications yet', subtitle: 'Successfully built applications appear here with links to the live app.' },
	};
</script>

<svelte:head>
	<title>In Development — Innovation Incubator</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

	<div class="space-y-2">
		<h1 class="text-3xl font-bold text-white">In Development</h1>
		<p class="text-white/60 max-w-2xl">
			Ideas that reached the community vote threshold are here being refined, built, and deployed.
			Browse ideas relevant to you, join the conversation, and help shape what gets built.
		</p>
	</div>

	<!-- How it works explainer -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
		<div class="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
			<div class="shrink-0 w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center mt-0.5">
				<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
				</svg>
			</div>
			<div>
				<p class="text-sm font-medium text-white/80 mb-0.5">1. Specification</p>
				<p class="text-xs text-white/40">AI facilitator asks questions and generates a specification document.</p>
			</div>
		</div>
		<div class="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
			<div class="shrink-0 w-8 h-8 rounded-lg bg-sky-500/15 flex items-center justify-center mt-0.5">
				<svg class="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
				</svg>
			</div>
			<div>
				<p class="text-sm font-medium text-white/80 mb-0.5">2. Build</p>
				<p class="text-xs text-white/40">AI autonomously builds, tests, and deploys the application.</p>
			</div>
		</div>
		<div class="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
			<div class="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center mt-0.5">
				<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<div>
				<p class="text-sm font-medium text-white/80 mb-0.5">3. Deployed</p>
				<p class="text-xs text-white/40">Live application accessible to users, source pushed to Git.</p>
			</div>
		</div>
	</div>

	<!-- Tab switcher -->
	<div class="flex gap-1 p-1 rounded-xl bg-white/5 w-fit flex-wrap">
		{#each tabs as tab}
			{@const count = getCount(tab.key)}
			<button
				onclick={() => activeTab = tab.key}
				class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
					{activeTab === tab.key
						? `${tab.bgActive} ${tab.color}`
						: 'text-white/50 hover:text-white/70'}"
			>
				{tab.label}
				{#if count > 0}
					<span class="px-1.5 py-0.5 rounded-full text-xs
						{activeTab === tab.key ? tab.badgeBg : 'bg-white/10 text-white/40'}">
						{count}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Ideas grid -->
	{#if displayedIdeas.length === 0}
		{@const empty = emptyStates[activeTab]}
		<div class="flex flex-col items-center justify-center py-20 text-center space-y-3">
			<div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
				<svg class="w-7 h-7 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={empty.icon} />
				</svg>
			</div>
			<p class="text-white/60 font-medium">{empty.title}</p>
			<p class="text-sm text-white/40">{empty.subtitle}</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each displayedIdeas as idea (idea.id)}
				<DevelopmentIdeaCard {idea} voteThreshold={data.voteThreshold} />
			{/each}
		</div>
	{/if}

</div>
