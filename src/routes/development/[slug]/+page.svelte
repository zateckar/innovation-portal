<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import IdeaChatPanel from '$lib/components/ideas/IdeaChatPanel.svelte';
	import IdeaSpecPanel from '$lib/components/ideas/IdeaSpecPanel.svelte';
	import SpecProgressBar from '$lib/components/ideas/SpecProgressBar.svelte';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS, type DepartmentCategory } from '$lib/types';
	import { marked } from 'marked';

	let { data } = $props();
	const idea = $derived(data.idea);
	let currentUserName = $derived($page.data.user?.name ?? 'You');

	function renderMarkdown(source: string): string {
		return marked.parse(source, { async: false }) as string;
	}

	let specStatusLabel = $derived(
		idea.specStatus === 'completed'
			? idea.specReviewStatus === 'published'
				? 'Published'
				: 'Ready for Review'
			: 'In Progress'
	);

	let specStatusColor = $derived(
		idea.specStatus === 'completed'
			? idea.specReviewStatus === 'published'
				? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
				: 'bg-violet-500/15 text-violet-300 border-violet-500/25'
			: 'bg-amber-500/15 text-amber-300 border-amber-500/25'
	);

	const deptColor = $derived(DEPARTMENT_COLORS[idea.department as DepartmentCategory] ?? '#94A3B8');
	const deptLabel = $derived(DEPARTMENT_LABELS[idea.department as DepartmentCategory] ?? idea.department);
</script>

<svelte:head>
	<title>{idea.title} — Development — Innovation Incubator</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

	<!-- Back link -->
	<a
		href="{base}/development"
		class="inline-flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
		</svg>
		Back to Development
	</a>

	<!-- Idea header card -->
	<div class="rounded-2xl border border-white/10 bg-bg-elevated overflow-hidden">
		<!-- Department colour strip -->
		<div class="h-1 w-full" style="background: linear-gradient(to right, {deptColor}40, {deptColor}10)"></div>

		<div class="px-6 py-5">
			<!-- Badges -->
			<div class="flex flex-wrap items-center gap-2 mb-3">
				<span
					class="px-2.5 py-0.5 rounded-full text-xs font-medium border"
					style="background-color: {deptColor}20; color: {deptColor}; border-color: {deptColor}40"
				>
					{deptLabel}
				</span>
				<span class="px-2.5 py-0.5 rounded-full text-xs font-medium border {specStatusColor}">
					{specStatusLabel}
				</span>
				{#if idea.hasParticipated}
					<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
						You contributed
					</span>
				{/if}
				<div class="ml-auto flex items-center gap-1.5 text-xs text-white/40">
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
					</svg>
					{idea.voteCount} vote{idea.voteCount !== 1 ? 's' : ''}
				</div>
			</div>

			<!-- Title -->
			<h1 class="text-2xl font-bold text-white mb-2 leading-snug">{idea.title}</h1>

			<!-- Summary -->
			<p class="text-white/60 leading-relaxed mb-4">{idea.summary}</p>

			<!-- View original idea link -->
			<a
				href="{base}/ideas/{idea.slug}"
				class="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors border border-white/10 hover:border-white/20 rounded-lg px-3 py-1.5"
			>
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
				</svg>
				View original idea
			</a>
		</div>
	</div>

	<!-- Problem & Solution (collapsible context) -->
	<details class="group rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
		<summary class="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none text-sm font-medium text-white/60 hover:text-white/80 transition-colors list-none">
			<span>Idea Background</span>
			<svg class="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</summary>
		<div class="px-5 pb-5 space-y-4 border-t border-white/[0.07]">
			<div class="pt-4">
				<h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Problem</h3>
				<p class="text-sm text-white/60 leading-relaxed">{idea.problem}</p>
			</div>
			<div>
				<h3 class="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Proposed Solution</h3>
				<div class="text-sm text-white/60 leading-relaxed prose prose-invert prose-sm max-w-none
					[&_p]:text-white/60 [&_p]:mb-2 [&_p:last-child]:mb-0
					[&_ul]:pl-4 [&_ul_li]:text-white/60 [&_strong]:text-white/80">
					{@html renderMarkdown(idea.solution)}
				</div>
			</div>
		</div>
	</details>

	<!-- Refinement Chat (shown when in progress, or when completed to review history) -->
	{#if idea.specStatus === 'in_progress' || (idea.specStatus === 'completed' && idea.chatMessages.length > 0)}
		<IdeaChatPanel
			ideaId={idea.id}
			initialMessages={idea.chatMessages}
			specStatus={idea.specStatus}
			{currentUserName}
		/>
	{/if}

	<!-- Specification Document (shown when completed) -->
	{#if idea.specStatus === 'completed' && idea.specDocument}
		<!-- Spec progress (all done) -->
		<div class="rounded-xl border border-white/[0.07] bg-white/[0.02] px-5 py-4">
			<SpecProgressBar specDocument={idea.specDocument} specStatus={idea.specStatus} compact={false} />
		</div>

		<IdeaSpecPanel
			ideaId={idea.id}
			specDocument={idea.specDocument}
			specReviewStatus={idea.specReviewStatus}
			hasParticipated={idea.hasParticipated ?? false}
			adoPrUrl={idea.adoPrUrl}
			jiraEscalationKey={idea.jiraEscalationKey}
			jiraWebHostname={data.jiraWebHostname}
		/>
	{/if}

</div>
