<script lang="ts">
	import { base } from '$app/paths';
	import { InnovationCard } from '$lib/components/innovations';
	import { CatalogCard } from '$lib/components/catalog';
	import { NewsCard } from '$lib/components/news';
	import { IdeaCard } from '$lib/components/ideas';
	import { TrendCard } from '$lib/components/trends';
	import {
		DEPARTMENT_LABELS,
		DEPARTMENT_COLORS,
		type DepartmentCategory
	} from '$lib/types';

	let { data } = $props();

	const deptEntries = Object.entries(DEPARTMENT_LABELS) as [DepartmentCategory, string][];
</script>

<svelte:head>
	<title>Get Inspiration — Innovation Portal</title>
</svelte:head>

<div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

	<!-- Hero -->
	<section class="mb-8">
		<div class="flex items-start justify-between flex-wrap gap-5">
			<div>
				<div class="flex items-center gap-2 mb-2">
					<span class="block w-7 h-0.5 rounded" style="background: linear-gradient(90deg,#00E5B8,transparent);"></span>
					<span style="font-family:var(--font-display); font-size:0.7rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:#00E5B8;">Get Inspiration</span>
				</div>
				<h1 class="text-text-primary" style="font-family:var(--font-display); font-size:clamp(1.9rem,3vw,2.6rem); font-weight:800; letter-spacing:-0.02em; line-height:1.05; margin-bottom:0.5rem;">
					Discover what's out there
				</h1>
				<p class="text-text-secondary" style="max-width:46rem;">
					News, trends, software on the market, catalog tools and generated ideas — all in one place. Vote on an idea to push it into development.
				</p>
			</div>

			<!-- Department filter -->
			<form method="POST" action="?/setDepartment" class="flex flex-col items-end gap-2 shrink-0">
				<span style="font-family:var(--font-display); font-size:0.65rem; font-weight:700; letter-spacing:0.10em; text-transform:uppercase; color:var(--color-text-muted);">Filter by Department</span>
				<div class="flex flex-wrap gap-1.5 justify-end" style="max-width:520px;">
					<button type="submit" name="dept" value=""
						class="rounded-full transition-colors"
						style="padding:0.3rem 0.7rem; font-family:var(--font-display); font-size:0.72rem; font-weight:700; letter-spacing:0.03em; cursor:pointer; border:1px solid {data.activeDept === null ? 'rgba(0,229,184,0.6)' : 'rgba(255,255,255,0.12)'}; background:{data.activeDept === null ? 'rgba(0,229,184,0.14)' : 'rgba(255,255,255,0.04)'}; color:{data.activeDept === null ? '#00E5B8' : 'var(--color-text-secondary)'};"
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
		{#if data.activeDept !== null}
			<p class="mt-3 text-sm text-text-muted">
				Showing content for <strong style="color:{DEPARTMENT_COLORS[data.activeDept]};">{DEPARTMENT_LABELS[data.activeDept]}</strong>
			</p>
		{/if}
	</section>

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

		<!-- Software on the Market -->
		<section>
			{@render sectionHead('Software on the Market', '/innovations', '#00E5B8', data.innovationsCount)}
			{#if data.innovations.length > 0}
				<div class="list-card-grid grid grid-cols-1 gap-4">
					{#each data.innovations as innovation (innovation.id)}
						<div class="animate-fade-in"><InnovationCard {innovation} showVote={false} /></div>
					{/each}
				</div>
			{:else}
				{@render emptyState('No software discovered yet for this department.')}
			{/if}
		</section>

		<!-- Catalog -->
		<section>
			{@render sectionHead('Incubator Catalog', '/catalog', '#3EEAA8', data.catalogCount)}
			{#if data.catalog.length > 0}
				<div class="list-card-grid grid grid-cols-1 gap-4">
					{#each data.catalog as item (item.id)}
						<div class="animate-fade-in"><CatalogCard {item} /></div>
					{/each}
				</div>
			{:else}
				{@render emptyState('No catalog tools yet for this department.')}
			{/if}
		</section>

		<!-- Generated Ideas -->
		<section>
			{@render sectionHead('Generated Ideas', '/ideas', '#FFC842', data.ideasCount)}
			{#if data.ideas.length > 0}
				<div class="list-card-grid grid grid-cols-1 gap-4">
					{#each data.ideas as idea (idea.id)}
						<div class="animate-fade-in"><IdeaCard {idea} /></div>
					{/each}
				</div>
			{:else}
				{@render emptyState('No generated ideas yet for this department.')}
			{/if}
		</section>

		<!-- News -->
		<section>
			{@render sectionHead('Industry News', '/news', '#93D9FF', data.newsCount)}
			{#if data.news.length > 0}
				<div class="list-card-grid grid grid-cols-1 gap-4">
					{#each data.news as item (item.id)}
						<div class="animate-fade-in"><NewsCard newsItem={item} /></div>
					{/each}
				</div>
			{:else}
				{@render emptyState('No news published yet for this department.')}
			{/if}
		</section>

		<!-- Trends -->
		<section>
			{@render sectionHead('Industry Trends', '/trends', '#FF7D55', data.trendsCount)}
			{#if data.trends.length > 0}
				<div class="list-card-grid grid grid-cols-1 gap-4">
					{#each data.trends as item (item.id)}
						<div class="animate-fade-in"><TrendCard trend={item} /></div>
					{/each}
				</div>
			{:else}
				{@render emptyState('No trends published yet.')}
			{/if}
		</section>

	</div>
</div>
