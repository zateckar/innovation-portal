<script lang="ts">
	import { base } from '$app/paths';
	import { Card } from '$lib/components/ui';
	import {
		TREND_CATEGORIES,
		TREND_GROUP_LABELS,
		TREND_GROUP_COLORS,
		MATURITY_LABELS,
		MATURITY_COLORS,
		type TrendCategoryGroup,
		type TrendMaturityLevel,
		type TrendVisualData
	} from '$lib/types';

	let { data } = $props();
	const trend = $derived(data.trend);
	const catInfo = $derived(TREND_CATEGORIES[trend.category] || { label: trend.category, icon: '📊', color: '#94A3B8', group: 'it' as TrendCategoryGroup });

	function formatDate(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('en-US', {
			weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
		});
	}

	// Render markdown-ish content to HTML
	function renderContent(content: string): string {
		return content
			.replace(/\n\n/g, '</p><p class="mb-4">')
			.replace(/\n/g, '<br />')
			.replace(/^/, '<p class="mb-4">')
			.replace(/$/, '</p>')
			.replace(/## (.*?)(<br \/>|<\/p>)/g, '</p><h2 class="text-xl font-semibold text-text-primary mt-8 mb-4">$1</h2><p class="mb-4">')
			.replace(/### (.*?)(<br \/>|<\/p>)/g, '</p><h3 class="text-lg font-semibold text-text-primary mt-6 mb-3">$1</h3><p class="mb-4">')
			.replace(/\*\*(.*?)\*\*/g, '<strong class="text-text-primary font-semibold">$1</strong>')
			.replace(/\*(.*?)\*/g, '<em>$1</em>')
			.replace(/- (.*?)(<br \/>)/g, '<li class="ml-4 list-disc text-text-secondary">$1</li>');
	}
</script>

<svelte:head>
	<title>{trend.title} - Industry Trends - Innovation Radar</title>
</svelte:head>

<style>
	@keyframes pulse-glow {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 1; }
	}
	@keyframes slide-in {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@keyframes grow-bar {
		from { width: 0; }
	}
	@keyframes draw-line {
		from { stroke-dashoffset: 1000; }
		to { stroke-dashoffset: 0; }
	}
	.animate-slide-in {
		animation: slide-in 0.5s ease-out both;
	}
	.animate-slide-in-delayed {
		animation: slide-in 0.5s ease-out 0.15s both;
	}
	.animate-slide-in-delayed-2 {
		animation: slide-in 0.5s ease-out 0.3s both;
	}
	.grow-bar-anim {
		animation: grow-bar 1s ease-out both;
	}
	.pulse-dot {
		animation: pulse-glow 2s ease-in-out infinite;
	}
</style>

<div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
	<!-- Ambient glow -->
	<div class="fixed top-0 right-0 w-96 h-96 rounded-full opacity-5 blur-3xl pointer-events-none" style="background: radial-gradient(circle, {catInfo.color} 0%, transparent 70%);"></div>

	<!-- Back link -->
	<a
		href="{base}/trends"
		class="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-6"
	>
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
		</svg>
		Back to Trends
	</a>

	<!-- Hero Header -->
	<div class="animate-slide-in rounded-2xl overflow-hidden mb-8" style="background: linear-gradient(135deg, {catInfo.color}08, {catInfo.color}03); border: 1px solid {catInfo.color}25;">
		<!-- Accent strip -->
		<div class="h-1.5" style="background: linear-gradient(90deg, {catInfo.color}, {catInfo.color}60, transparent);"></div>

		<div class="p-6 lg:p-8">
			<!-- Category + Group badges -->
			<div class="flex flex-wrap items-center gap-3 mb-4">
				<span class="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full"
					style="background: {catInfo.color}18; color: {catInfo.color}; border: 1px solid {catInfo.color}35;">
					<span class="text-base">{catInfo.icon}</span>
					{catInfo.label}
				</span>
				<span class="text-xs font-medium px-2.5 py-1 rounded-full"
					style="background: {TREND_GROUP_COLORS[trend.categoryGroup as TrendCategoryGroup]}15; color: {TREND_GROUP_COLORS[trend.categoryGroup as TrendCategoryGroup]};">
					{TREND_GROUP_LABELS[trend.categoryGroup as TrendCategoryGroup]}
				</span>
				{#if trend.maturityLevel}
					<span class="text-xs font-semibold px-2.5 py-1 rounded"
						style="color: {MATURITY_COLORS[trend.maturityLevel as TrendMaturityLevel]}; background: {MATURITY_COLORS[trend.maturityLevel as TrendMaturityLevel]}15;">
						● {MATURITY_LABELS[trend.maturityLevel as TrendMaturityLevel]}
					</span>
				{/if}
			</div>

			<!-- Title -->
			<h1 class="text-3xl lg:text-4xl font-bold text-text-primary mb-4 leading-tight">
				{trend.title}
			</h1>

			<!-- Meta row -->
			<div class="flex flex-wrap items-center gap-6 text-sm text-text-muted mb-6">
				{#if trend.publishedAt}
					<div class="flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
						</svg>
						{formatDate(trend.publishedAt)}
					</div>
				{/if}
				{#if trend.timeHorizon}
					<div class="flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
						<span class="capitalize">{trend.timeHorizon.replace('-', ' ')} horizon</span>
					</div>
				{/if}
			</div>

			<!-- Summary -->
			<p class="text-text-secondary text-lg leading-relaxed border-l-4 pl-4" style="border-color: {catInfo.color}60;">
				{trend.summary}
			</p>
		</div>
	</div>

	<!-- Visual Data Section -->
	{#if trend.visualData}
		<div class="animate-slide-in-delayed grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

			<!-- Impact Score Gauge -->
			{#if trend.impactScore !== null}
				<Card padding="lg">
					<h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Impact Score</h3>
					<div class="flex items-center justify-center">
						<svg viewBox="0 0 200 120" class="w-48 h-28">
							<!-- Background arc -->
							<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12" stroke-linecap="round"/>
							<!-- Score arc -->
							<path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="{catInfo.color}" stroke-width="12" stroke-linecap="round"
								stroke-dasharray="{(trend.impactScore ?? 0) * 251.2} 251.2"
								style="filter: drop-shadow(0 0 8px {catInfo.color}60);"
							/>
							<!-- Score text -->
							<text x="100" y="85" text-anchor="middle" fill="white" font-size="28" font-weight="bold" font-family="var(--font-display)">
								{Math.round((trend.impactScore ?? 0) * 100)}%
							</text>
							<text x="100" y="105" text-anchor="middle" fill="rgba(255,255,255,0.4)" font-size="11" font-family="var(--font-sans)">
								impact level
							</text>
						</svg>
					</div>
				</Card>
			{/if}

			<!-- Maturity Gauge -->
			{#if trend.maturityLevel}
				{@const stages = ['emerging', 'growing', 'mature', 'declining']}
				{@const currentIdx = stages.indexOf(trend.maturityLevel)}
				<Card padding="lg">
					<h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Maturity Stage</h3>
					<div class="flex items-end justify-between gap-2 h-24 px-4">
						{#each stages as stage, i}
							{@const isActive = i <= currentIdx}
							{@const isCurrent = i === currentIdx}
							{@const heights = [40, 65, 90, 55]}
							<div class="flex flex-col items-center gap-2 flex-1">
								<div
									class="w-full rounded-t-lg transition-all grow-bar-anim"
									style="height: {heights[i]}%; background: {isActive ? MATURITY_COLORS[stage as keyof typeof MATURITY_COLORS] : 'rgba(255,255,255,0.06)'}; opacity: {isCurrent ? 1 : isActive ? 0.5 : 0.3}; {isCurrent ? `box-shadow: 0 0 12px ${MATURITY_COLORS[stage as keyof typeof MATURITY_COLORS]}50;` : ''}"
								></div>
								<span class="text-[10px] font-medium {isCurrent ? 'text-text-primary' : 'text-text-muted'} text-center capitalize">{stage}</span>
								{#if isCurrent}
									<div class="w-1.5 h-1.5 rounded-full pulse-dot" style="background: {MATURITY_COLORS[stage as keyof typeof MATURITY_COLORS]}; box-shadow: 0 0 6px {MATURITY_COLORS[stage as keyof typeof MATURITY_COLORS]};"></div>
								{/if}
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- Stats Cards -->
			{#if trend.visualData.stats && trend.visualData.stats.length > 0}
				<Card padding="lg" class="lg:col-span-2">
					<h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Key Statistics</h3>
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
						{#each trend.visualData.stats as stat}
							<div class="text-center p-4 rounded-xl" style="background: {catInfo.color}08; border: 1px solid {catInfo.color}15;">
								<div class="text-2xl font-bold text-text-primary mb-1" style="font-family: var(--font-display);">
									{stat.value}
									{#if stat.trend === 'up'}
										<span class="text-success text-sm">↑</span>
									{:else if stat.trend === 'down'}
										<span class="text-error text-sm">↓</span>
									{:else}
										<span class="text-text-muted text-sm">→</span>
									{/if}
								</div>
								<div class="text-xs text-text-muted">{stat.label}</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- Adoption Curve -->
			{#if trend.visualData.adoptionCurve && trend.visualData.adoptionCurve.length > 0}
				<Card padding="lg" class="lg:col-span-2">
					<h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Adoption Curve</h3>
					<div class="space-y-3">
						{#each trend.visualData.adoptionCurve as phase}
							<div class="flex items-center gap-4">
								<div class="w-32 text-sm text-text-secondary text-right shrink-0 truncate">{phase.phase}</div>
								<div class="flex-1 h-6 bg-bg-hover rounded-full overflow-hidden relative">
									<div
										class="h-full rounded-full grow-bar-anim relative"
										style="width: {phase.percentage}%; background: {phase.current ? catInfo.color : catInfo.color + '50'}; {phase.current ? `box-shadow: 0 0 12px ${catInfo.color}40;` : ''}"
									>
										{#if phase.current}
											<div class="absolute right-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white pulse-dot"></div>
										{/if}
									</div>
								</div>
								<span class="w-12 text-sm text-text-muted text-right">{phase.percentage}%</span>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- Impact Dimensions (Radar-like horizontal bars) -->
			{#if trend.visualData.impactDimensions && trend.visualData.impactDimensions.length > 0}
				<Card padding="lg" class="lg:col-span-2">
					<h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Impact Dimensions</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
						{#each trend.visualData.impactDimensions as dim}
							<div>
								<div class="flex justify-between text-sm mb-1">
									<span class="text-text-secondary">{dim.dimension}</span>
									<span class="text-text-muted font-mono">{Math.round(dim.score * 10)}/10</span>
								</div>
								<div class="h-2 bg-bg-hover rounded-full overflow-hidden">
									<div class="h-full rounded-full grow-bar-anim" style="width: {dim.score * 100}%; background: linear-gradient(90deg, {catInfo.color}80, {catInfo.color});"></div>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			<!-- Timeline -->
			{#if trend.visualData.timeline && trend.visualData.timeline.length > 0}
				<Card padding="lg" class="lg:col-span-2">
					<h3 class="text-sm font-semibold text-text-muted uppercase tracking-wider mb-6">Timeline</h3>
					<div class="relative">
						<!-- Vertical line -->
						<div class="absolute left-4 top-0 bottom-0 w-px" style="background: linear-gradient(to bottom, {catInfo.color}60, {catInfo.color}20);"></div>

						<div class="space-y-6">
							{#each trend.visualData.timeline as entry, i}
								{@const isPast = entry.type === 'past'}
								{@const isPresent = entry.type === 'present'}
								{@const isFuture = entry.type === 'future'}
								<div class="flex gap-4 items-start" style="animation: slide-in 0.4s ease-out {0.1 * i}s both;">
									<!-- Dot -->
									<div class="relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
										style="background: {isPresent ? catInfo.color : isPast ? catInfo.color + '30' : 'rgba(255,255,255,0.06)'}; border: 2px solid {isPresent ? catInfo.color : isPast ? catInfo.color + '50' : 'rgba(255,255,255,0.12)'}; {isPresent ? `box-shadow: 0 0 16px ${catInfo.color}50;` : ''}">
										{#if isPresent}
											<div class="w-2 h-2 rounded-full bg-white pulse-dot"></div>
										{:else if isPast}
											<svg class="w-3 h-3" style="color: {catInfo.color};" fill="currentColor" viewBox="0 0 20 20">
												<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
											</svg>
										{:else}
											<svg class="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h.01M12 12h.01M19 12h.01"/>
											</svg>
										{/if}
									</div>

									<!-- Content -->
									<div class="flex-1 pb-2">
										<div class="flex items-center gap-3 mb-1">
											<span class="font-mono text-sm font-bold {isPresent ? 'text-text-primary' : 'text-text-muted'}">{entry.year}</span>
											{#if isPresent}
												<span class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded" style="background: {catInfo.color}20; color: {catInfo.color};">Now</span>
											{:else if isFuture}
												<span class="text-[10px] font-medium uppercase tracking-wider text-text-muted px-2 py-0.5 rounded bg-bg-hover">Predicted</span>
											{/if}
										</div>
										<p class="text-sm {isPresent ? 'text-text-primary' : isPast ? 'text-text-secondary' : 'text-text-muted'} {isFuture ? 'italic' : ''}">
											{entry.event}
										</p>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</Card>
			{/if}
		</div>
	{/if}

	<!-- Key Insights -->
	{#if trend.keyInsights && trend.keyInsights.length > 0}
		<div class="animate-slide-in-delayed mb-8">
			<Card padding="lg">
				<h2 class="text-xl font-semibold text-text-primary mb-5 flex items-center gap-2">
					<svg class="w-5 h-5" style="color: {catInfo.color};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
					</svg>
					Key Insights
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					{#each trend.keyInsights as insight, i}
						<div class="flex items-start gap-3 p-3 rounded-lg" style="background: {catInfo.color}06; border: 1px solid {catInfo.color}12;">
							<div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
								style="background: {catInfo.color}20; color: {catInfo.color};">
								{i + 1}
							</div>
							<p class="text-sm text-text-secondary leading-relaxed">{insight}</p>
						</div>
					{/each}
				</div>
			</Card>
		</div>
	{/if}

	<!-- Content -->
	<div class="animate-slide-in-delayed-2 mb-8">
		<Card padding="lg">
			<div class="prose-content text-text-primary leading-relaxed space-y-4">
				{@html renderContent(trend.content)}
			</div>
		</Card>
	</div>

	<!-- Sources -->
	{#if trend.sources && trend.sources.length > 0}
		<Card padding="lg">
			<h2 class="text-xl font-semibold text-text-primary mb-4 flex items-center gap-2">
				<svg class="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path>
				</svg>
				Sources & References
			</h2>
			<ul class="space-y-3">
				{#each trend.sources as source}
					<li>
						<a
							href={source.url}
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm inline-flex items-center gap-1 transition-colors"
							style="color: {catInfo.color};"
						>
							{source.title || source.url}
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
							</svg>
						</a>
					</li>
				{/each}
			</ul>
		</Card>
	{/if}
</div>
