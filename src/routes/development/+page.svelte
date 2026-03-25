<script lang="ts">
	import DevelopmentIdeaCard from '$lib/components/ideas/DevelopmentIdeaCard.svelte';

	let { data } = $props();

	let activeTab = $state<'in_progress' | 'under_review'>('in_progress');
	let displayedIdeas = $derived(activeTab === 'in_progress' ? data.inProgress : data.underReview);
</script>

<svelte:head>
	<title>In Development — Innovation Incubator</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

	<div class="space-y-2">
		<h1 class="text-3xl font-bold text-white">In Development</h1>
		<p class="text-white/60 max-w-2xl">
			Ideas that reached the community vote threshold are here being refined into complete specifications.
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
				<p class="text-sm font-medium text-white/80 mb-0.5">1. Join the conversation</p>
				<p class="text-xs text-white/40">Answer the AI facilitator's questions about the idea. 8–15 exchanges shape the spec.</p>
			</div>
		</div>
		<div class="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
			<div class="shrink-0 w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center mt-0.5">
				<svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
				</svg>
			</div>
			<div>
				<p class="text-sm font-medium text-white/80 mb-0.5">2. Review the spec</p>
				<p class="text-xs text-white/40">Once the AI has enough detail it auto-generates a 9-section specification for review.</p>
			</div>
		</div>
		<div class="flex items-start gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
			<div class="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center mt-0.5">
				<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</div>
			<div>
				<p class="text-sm font-medium text-white/80 mb-0.5">3. Publish to DevOps</p>
				<p class="text-xs text-white/40">Participants approve and publish — a PR is created in Azure DevOps and a Jira issue is linked.</p>
			</div>
		</div>
	</div>

	<!-- Tab switcher -->
	<div class="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
		<button
			onclick={() => activeTab = 'in_progress'}
			class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
				{activeTab === 'in_progress'
					? 'bg-amber-500/20 text-amber-300'
					: 'text-white/50 hover:text-white/70'}"
		>
			In Progress
			{#if data.inProgress.length > 0}
				<span class="px-1.5 py-0.5 rounded-full text-xs
					{activeTab === 'in_progress' ? 'bg-amber-500/30 text-amber-200' : 'bg-white/10 text-white/40'}">
					{data.inProgress.length}
				</span>
			{/if}
		</button>
		<button
			onclick={() => activeTab = 'under_review'}
			class="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
				{activeTab === 'under_review'
					? 'bg-violet-500/20 text-violet-300'
					: 'text-white/50 hover:text-white/70'}"
		>
			Ready for Review
			{#if data.underReview.length > 0}
				<span class="px-1.5 py-0.5 rounded-full text-xs
					{activeTab === 'under_review' ? 'bg-violet-500/30 text-violet-200' : 'bg-white/10 text-white/40'}">
					{data.underReview.length}
				</span>
			{/if}
		</button>
	</div>

	<!-- Ideas grid -->
	{#if displayedIdeas.length === 0}
		<div class="flex flex-col items-center justify-center py-20 text-center space-y-3">
			{#if activeTab === 'in_progress'}
				<div class="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
					<svg class="w-7 h-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
							d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
				</div>
				<p class="text-white/60 font-medium">No ideas in active development</p>
				<p class="text-sm text-white/40">Ideas reach this stage when enough community members vote for them.</p>
			{:else}
				<div class="w-14 h-14 rounded-2xl bg-violet-500/10 flex items-center justify-center">
					<svg class="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
				</div>
				<p class="text-white/60 font-medium">No specifications awaiting review</p>
				<p class="text-sm text-white/40">Completed specifications appear here for review before publishing to DevOps.</p>
			{/if}
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each displayedIdeas as idea (idea.id)}
				<DevelopmentIdeaCard {idea} voteThreshold={data.voteThreshold} />
			{/each}
		</div>
	{/if}

</div>
