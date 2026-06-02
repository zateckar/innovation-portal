<script lang="ts">
	import { base } from '$app/paths';
	import IdeaCard from '$lib/components/ideas/IdeaCard.svelte';
	import DevelopmentIdeaCard from '$lib/components/ideas/DevelopmentIdeaCard.svelte';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS, type DepartmentCategory } from '$lib/types';

	let { data } = $props();

	const deptEntries = Object.entries(DEPARTMENT_LABELS) as [DepartmentCategory, string][];
</script>

<svelte:head>
	<title>Build your Ideas — Innovation Portal</title>
</svelte:head>

<div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

	<!-- Hero -->
	<section class="mb-8">
		<div class="flex items-start justify-between flex-wrap gap-5">
			<div>
				<div class="flex items-center gap-2 mb-2">
					<span class="block w-7 h-0.5 rounded" style="background: linear-gradient(90deg,#B8A0FF,transparent);"></span>
					<span style="font-family:var(--font-display); font-size:0.7rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#B8A0FF;">Build your Ideas</span>
				</div>
				<h1 class="text-text-primary" style="font-family:var(--font-display); font-size:clamp(1.9rem,3vw,2.6rem); font-weight:800; letter-spacing:-0.02em; line-height:1.05; margin-bottom:0.5rem;">
					Propose, vote, and build
				</h1>
				<p class="text-text-secondary" style="max-width:46rem;">
					Submit your own ideas and follow them through the same pipeline as generated ones — vote to graduate them into development.
				</p>
			</div>

			<!-- Department filter -->
			<form method="POST" action="?/setDepartment" class="flex flex-col items-end gap-2 shrink-0">
				<span style="font-family:var(--font-display); font-size:0.65rem; font-weight:700; letter-spacing:0.10em; text-transform:uppercase; color:var(--color-text-muted);">Filter by Department</span>
				<div class="flex flex-wrap gap-1.5 justify-end" style="max-width:520px;">
					<button type="submit" name="dept" value=""
						class="rounded-full transition-colors"
						style="padding:0.3rem 0.7rem; font-family:var(--font-display); font-size:0.72rem; font-weight:700; letter-spacing:0.03em; cursor:pointer; border:1px solid {data.activeDept === null ? 'rgba(184,160,255,0.6)' : 'rgba(255,255,255,0.12)'}; background:{data.activeDept === null ? 'rgba(184,160,255,0.14)' : 'rgba(255,255,255,0.04)'}; color:{data.activeDept === null ? '#B8A0FF' : 'var(--color-text-secondary)'};"
					>All</button>
					{#each deptEntries as [key, label]}
						{@const c = DEPARTMENT_COLORS[key]}
						{@const active = data.activeDept === key}
						<button type="submit" name="dept" value={key} title={label}
							class="rounded-full transition-colors"
							style="padding:0.3rem 0.7rem; font-family:var(--font-display); font-size:0.72rem; font-weight:700; letter-spacing:0.03em; cursor:pointer; white-space:nowrap; border:1px solid {active ? c + 'AA' : 'rgba(255,255,255,0.10)'}; background:{active ? c + '22' : 'rgba(255,255,255,0.03)'}; color:{active ? c : 'var(--color-text-secondary)'};"
						>{label.split(' ')[0]}</button>
					{/each}
				</div>
			</form>
		</div>
	</section>

	<!-- Propose CTA -->
	<a href="{base}/propose" class="group block mb-12" style="text-decoration:none;">
		<div class="glass glass-hover rounded-2xl p-6 flex items-center gap-5" style="border-color: rgba(255,200,66,0.25);">
			<span class="flex items-center justify-center w-14 h-14 rounded-xl shrink-0" style="background: rgba(255,200,66,0.14); border:1px solid rgba(255,200,66,0.35);">
				<svg class="w-7 h-7" style="color:#FFC842;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4"/></svg>
			</span>
			<div class="flex-1 min-w-0">
				<h2 class="text-text-primary" style="font-family:var(--font-display); font-size:1.2rem; font-weight:700;">Propose a new idea</h2>
				<p class="text-text-secondary text-sm mt-0.5">Describe a problem and a solution — the team can vote it into development.</p>
			</div>
			<span class="shrink-0 text-sm font-semibold transition-transform group-hover:translate-x-1" style="color:#FFC842;">Get started →</span>
		</div>
	</a>

	{#snippet sectionHead(title: string, href: string, color: string, total: number)}
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-2.5">
				<span class="block w-1 h-5 rounded" style="background:{color};"></span>
				<h2 class="text-text-primary" style="font-family:var(--font-display); font-size:1.125rem; font-weight:700; letter-spacing:-0.01em;">{title}</h2>
				<span class="text-text-muted text-sm">({total})</span>
			</div>
			<a href="{base}{href}" class="text-sm font-semibold transition-opacity hover:opacity-80" style="color:{color}; text-decoration:none;">View all →</a>
		</div>
	{/snippet}

	{#snippet emptyState(text: string)}
		<div class="glass rounded-xl py-10 text-center text-text-muted text-sm">{text}</div>
	{/snippet}

	<div class="flex flex-col gap-12">

		<!-- My / user-proposed ideas -->
		<section>
			{@render sectionHead('User-proposed Ideas', '/ideas?source=user', '#FFC842', data.userIdeasCount)}
			{#if data.userIdeas.length > 0}
				<div class="list-card-grid grid grid-cols-1 gap-4">
					{#each data.userIdeas as idea (idea.id)}
						<div class="animate-fade-in"><IdeaCard {idea} /></div>
					{/each}
				</div>
			{:else}
				{@render emptyState('No user-proposed ideas yet — be the first to propose one.')}
			{/if}
		</section>

		<!-- In development -->
		<section>
			{@render sectionHead('In Development', '/development', '#B8A0FF', data.devCounts.total)}
			{#if data.devItems.length > 0}
				<div class="list-card-grid grid grid-cols-1 gap-4">
					{#each data.devItems as idea (idea.id)}
						<div class="animate-fade-in"><DevelopmentIdeaCard {idea} /></div>
					{/each}
				</div>
			{:else}
				{@render emptyState('Nothing in development yet. Ideas that reach the vote threshold appear here.')}
			{/if}
		</section>

	</div>
</div>
