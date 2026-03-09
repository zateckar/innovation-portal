<script lang="ts">
	import { base } from '$app/paths';
	import { InnovationCard } from '$lib/components/innovations';
	import { Badge, Card } from '$lib/components/ui';
	import { CATEGORY_LABELS, DEPARTMENT_LABELS, DEPARTMENT_COLORS, type InnovationCategory, type DepartmentCategory } from '$lib/types';
	import RadarVisualization from '$lib/components/innovations/RadarVisualization.svelte';
	
	let { data } = $props();
	
	const categories = Object.entries(CATEGORY_LABELS) as [InnovationCategory, string][];

	function getDepartmentGradient(department: string): string {
		const gradients: Record<string, string> = {
			'rd': 'from-purple-500 to-violet-700',
			'production': 'from-amber-500 to-orange-700',
			'hr': 'from-pink-500 to-rose-700',
			'legal': 'from-indigo-500 to-blue-700',
			'finance': 'from-emerald-500 to-green-700',
			'it': 'from-cyan-500 to-sky-700',
			'purchasing': 'from-red-500 to-rose-700',
			'quality': 'from-lime-500 to-green-700',
			'logistics': 'from-orange-500 to-amber-700',
			'general': 'from-slate-500 to-gray-700'
		};
		return gradients[department] || 'from-slate-500 to-gray-700';
	}

	function formatDate(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function getScoreColor(score: number | null): string {
		if (score === null) return 'text-text-muted';
		if (score >= 7) return 'text-emerald-400';
		if (score >= 4) return 'text-amber-400';
		return 'text-red-400';
	}

	function getScoreWidth(score: number | null): string {
		if (score === null) return '0%';
		return `${(score / 10) * 100}%`;
	}
</script>

<svelte:head>
	<title>Dashboard - Innovation Portal</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

	<!-- Hero -->
	<section class="text-center mb-10">
		<h1 class="text-4xl md:text-5xl font-bold mb-3">
			<span class="gradient-text">Dashboard</span>
		</h1>
		<p class="text-lg text-text-secondary max-w-2xl mx-auto">
			Your at-a-glance view of innovations, ideas, and industry news — powered by AI.
		</p>
	</section>

	<!-- Stats bar -->
	<section class="mb-10">
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
			<div class="glass rounded-xl p-4 text-center">
				<div class="text-3xl font-bold gradient-text">{data.innovations.length > 0 ? Object.values(data.categoryCounts).reduce((a, b) => a + b, 0) : 0}</div>
				<div class="text-xs text-text-muted mt-1 uppercase tracking-wider">Innovations</div>
			</div>
			<div class="glass rounded-xl p-4 text-center">
				<div class="text-3xl font-bold text-amber-400">{data.ideas.length}</div>
				<div class="text-xs text-text-muted mt-1 uppercase tracking-wider">Ideas</div>
			</div>
			<div class="glass rounded-xl p-4 text-center">
				<div class="text-3xl font-bold text-blue-400">{data.news.length}</div>
				<div class="text-xs text-text-muted mt-1 uppercase tracking-wider">News</div>
			</div>
			<div class="glass rounded-xl p-4 text-center">
				<div class="text-3xl font-bold text-emerald-400">{data.catalogItems.length}</div>
				<div class="text-xs text-text-muted mt-1 uppercase tracking-wider">In Catalog</div>
			</div>
		</div>
	</section>

	<!-- Innovation Radar -->
	<section class="mb-10">
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
					<svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</div>
				<h2 class="text-xl font-bold text-white">Innovation Radar</h2>
			</div>
			<a href="{base}/innovations" class="text-violet-400 hover:text-violet-300 text-sm transition-colors flex items-center gap-1">
				Browse all
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
				</svg>
			</a>
		</div>
		<Card padding="lg" class="overflow-hidden">
			<RadarVisualization innovations={data.innovations} />
		</Card>
	</section>

	<!-- Two-column: Top Innovations + Latest News -->
	<div class="grid lg:grid-cols-5 gap-6 mb-10">

		<!-- Top Innovations (wider column) -->
		<section class="lg:col-span-3">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
					</div>
					<h2 class="text-xl font-bold text-white">Top Innovations</h2>
				</div>
				<a href="{base}/innovations" class="text-violet-400 hover:text-violet-300 text-sm transition-colors flex items-center gap-1">
					View all
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
					</svg>
				</a>
			</div>
			{#if data.innovations.length > 0}
				<div class="grid sm:grid-cols-2 gap-4">
					{#each data.innovations as innovation (innovation.id)}
						<div class="animate-fade-in">
							<InnovationCard {innovation} />
						</div>
					{/each}
				</div>
			{:else}
				<Card padding="lg" class="text-center py-12">
					<div class="w-14 h-14 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
						<svg class="w-7 h-7 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
						</svg>
					</div>
					<p class="text-text-secondary text-sm">No innovations published yet.</p>
				</Card>
			{/if}
		</section>

		<!-- Latest News (narrower column) -->
		<section class="lg:col-span-2">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
						</svg>
					</div>
					<h2 class="text-xl font-bold text-white">Latest News</h2>
				</div>
				<a href="{base}/news" class="text-blue-400 hover:text-blue-300 text-sm transition-colors flex items-center gap-1">
					View all
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
					</svg>
				</a>
			</div>

			{#if data.news.length > 0}
				<div class="flex flex-col gap-3">
					{#each data.news as item (item.id)}
						{@const deptColor = DEPARTMENT_COLORS[item.category as DepartmentCategory] ?? '#6B7280'}
						<a href="{base}/news/{item.slug}" class="group block animate-fade-in">
							<div class="glass rounded-xl overflow-hidden hover:border-blue-500/40 transition-all duration-200 hover:-translate-y-0.5">
								<!-- Accent bar -->
								<div class="h-1 w-full" style="background: linear-gradient(to right, {deptColor}99, {deptColor}22)"></div>
								<div class="p-4">
									<div class="flex items-start justify-between gap-3 mb-2">
										<span
											class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs shrink-0"
											style="background-color: {deptColor}20; color: {deptColor}; border-color: {deptColor}40"
										>
											{DEPARTMENT_LABELS[item.category as DepartmentCategory] ?? item.category}
										</span>
										{#if item.publishedAt}
											<span class="text-xs text-text-muted shrink-0">{formatDate(item.publishedAt)}</span>
										{/if}
									</div>
									<h3 class="text-sm font-semibold text-text-primary group-hover:text-blue-300 transition-colors line-clamp-2 mb-1.5">
										{item.title}
									</h3>
									<p class="text-xs text-text-secondary line-clamp-2 mb-2">
										{item.summary}
									</p>
									{#if item.relevanceScore !== null}
										<div class="flex items-center gap-2">
											<div class="flex-1 h-1 bg-bg-elevated rounded-full overflow-hidden">
												<div
													class="h-full rounded-full transition-all"
													style="width: {getScoreWidth(item.relevanceScore)}; background: linear-gradient(to right, #3B82F6, #818CF8)"
												></div>
											</div>
											<span class="text-xs {getScoreColor(item.relevanceScore)} font-medium tabular-nums">
												{item.relevanceScore}/10
											</span>
										</div>
									{/if}
								</div>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<Card padding="lg" class="text-center py-12">
					<div class="w-14 h-14 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
						<svg class="w-7 h-7 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
						</svg>
					</div>
					<p class="text-text-secondary text-sm">No news published yet.</p>
				</Card>
			{/if}
		</section>

	</div>

	<!-- Ideas Spotlight -->
	<section class="mb-10">
		<div class="flex items-center justify-between mb-4">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
					<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
				</div>
				<h2 class="text-xl font-bold text-white">Top Ideas</h2>
				<span class="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-2 py-0.5 font-medium">
					AI-generated &amp; community voted
				</span>
			</div>
			<a href="{base}/ideas" class="text-amber-400 hover:text-amber-300 text-sm transition-colors flex items-center gap-1">
				View all
				<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
				</svg>
			</a>
		</div>

		{#if data.ideas.length > 0}
			<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each data.ideas as idea, i (idea.id)}
					{@const deptColor = DEPARTMENT_COLORS[idea.department as DepartmentCategory] ?? '#6B7280'}
					<a href="{base}/ideas/{idea.slug}" class="group block animate-fade-in">
						<div class="glass rounded-xl overflow-hidden h-full flex flex-col hover:border-amber-500/40 transition-all duration-200 hover:-translate-y-0.5">
							<!-- Gradient header strip -->
							<div class="relative h-20 bg-gradient-to-br {getDepartmentGradient(idea.department)} flex items-center justify-center overflow-hidden">
								<!-- Large rank number watermark -->
								<span class="absolute right-3 bottom-1 text-5xl font-black text-white/10 leading-none select-none">#{i + 1}</span>
								<!-- Lightbulb icon -->
								<svg class="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
								</svg>
								<!-- Dept badge -->
								<div class="absolute top-2 left-2">
									<span
										class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs"
										style="background-color: {deptColor}30; color: #fff; border-color: {deptColor}50"
									>
										{DEPARTMENT_LABELS[idea.department as DepartmentCategory] ?? idea.department}
									</span>
								</div>
								<!-- Vote count bubble -->
								{#if idea.voteCount > 0}
									<div class="absolute top-2 right-2 flex items-center gap-1 bg-black/30 rounded-full px-2 py-0.5">
										<svg class="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
											<path d="M5 15l7-7 7 7H5z" />
										</svg>
										<span class="text-xs text-white font-medium">{idea.voteCount}</span>
									</div>
								{/if}
							</div>

							<!-- Content -->
							<div class="p-4 flex flex-col flex-1">
								<h3 class="text-sm font-semibold text-text-primary group-hover:text-amber-300 transition-colors line-clamp-2 mb-2">
									{idea.title}
								</h3>
								<p class="text-xs text-text-secondary line-clamp-2 mb-3 flex-1">
									{idea.summary}
								</p>

								<!-- Evaluation score bar -->
								{#if idea.evaluationScore !== null}
									<div>
										<div class="flex items-center justify-between mb-1">
											<span class="text-xs text-text-muted">Eval. Score</span>
											<span class="text-xs font-semibold {getScoreColor(idea.evaluationScore)}">{idea.evaluationScore.toFixed(1)}</span>
										</div>
										<div class="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
											<div
												class="h-full rounded-full"
												style="width: {getScoreWidth(idea.evaluationScore)}; background: linear-gradient(to right, #F59E0B, #EF4444)"
											></div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<Card padding="lg" class="text-center py-12">
				<div class="w-14 h-14 mx-auto mb-4 rounded-full bg-bg-elevated flex items-center justify-center">
					<svg class="w-7 h-7 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
				</div>
				<p class="text-text-secondary text-sm">No ideas published yet.</p>
			</Card>
		{/if}
	</section>

	<!-- Category Filter Pills -->
	<section class="mb-10">
		<div class="flex flex-wrap justify-center gap-2">
			{#each categories as [category, label]}
				<a href="{base}/innovations?category={category}" class="group">
					<Badge variant="category" {category} size="md">
						{label}
						{#if data.categoryCounts[category]}
							<span class="ml-1.5 opacity-60">({data.categoryCounts[category]})</span>
						{/if}
					</Badge>
				</a>
			{/each}
		</div>
	</section>

	<!-- Catalog Ready to Try -->
	{#if data.catalogItems && data.catalogItems.length > 0}
		<section class="mb-4">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
						<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
						</svg>
					</div>
					<h2 class="text-xl font-bold text-white">Ready to Try</h2>
				</div>
				<a href="{base}/catalog" class="text-emerald-400 hover:text-emerald-300 text-sm transition-colors flex items-center gap-1">
					View all
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
					</svg>
				</a>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each data.catalogItems as item (item.id)}
					<a href="{base}/catalog/{item.slug}" class="group block animate-fade-in">
						<div class="glass rounded-xl p-4 h-full flex flex-col hover:border-emerald-500/40 transition-all duration-200 hover:-translate-y-0.5">
							<div class="flex items-center gap-3 mb-3">
								{#if item.iconUrl}
									<img src={item.iconUrl} alt={item.name} class="w-10 h-10 rounded-lg object-cover" />
								{:else}
									<div class="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
										<svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
										</svg>
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<h3 class="text-sm font-semibold text-text-primary group-hover:text-emerald-300 transition-colors truncate">{item.name}</h3>
									<Badge variant="category" category={item.category} size="sm">{item.category}</Badge>
								</div>
							</div>
							<p class="text-xs text-text-secondary line-clamp-2 flex-1">{item.description}</p>
							<div class="mt-3 pt-3 border-t border-border flex items-center justify-between">
								<span class="inline-flex items-center gap-1 text-xs text-emerald-400">
									<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
									Active
								</span>
								<span class="text-xs text-text-muted group-hover:text-emerald-400 transition-colors">Try it →</span>
							</div>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

</div>
