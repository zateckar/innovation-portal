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
			'rd': 'from-purple-600/25 to-violet-900/25',
			'production': 'from-amber-600/25 to-orange-900/25',
			'hr': 'from-pink-600/25 to-rose-900/25',
			'legal': 'from-indigo-600/25 to-blue-900/25',
			'finance': 'from-emerald-600/25 to-green-900/25',
			'it': 'from-cyan-600/25 to-sky-900/25',
			'purchasing': 'from-red-600/25 to-rose-900/25',
			'quality': 'from-lime-600/25 to-green-900/25',
			'logistics': 'from-orange-600/25 to-amber-900/25',
			'general': 'from-slate-600/25 to-gray-900/25'
		};
		return gradients[department] || 'from-slate-600/25 to-gray-900/25';
	}

	function formatDate(date: Date | null): string {
		if (!date) return '';
		return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function getScoreColor(score: number | null): string {
		if (score === null) return 'color:var(--color-text-muted)';
		if (score >= 7) return 'color:#18EAB0';
		if (score >= 4) return 'color:#FAB93A';
		return 'color:#FF5C6B';
	}

	function getScoreWidth(score: number | null): string {
		if (score === null) return '0%';
		return `${(score / 10) * 100}%`;
	}

	function totalInnovations(): number {
		return Object.values(data.categoryCounts).reduce((a: number, b) => a + (b as number), 0);
	}
</script>

<svelte:head>
	<title>Dashboard — Innovation Portal</title>
</svelte:head>

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

	<!-- Hero Header -->
	<section style="margin-bottom: 2.5rem;">
		<div style="
			display: flex;
			align-items: flex-end;
			justify-content: space-between;
			flex-wrap: wrap;
			gap: 1rem;
		">
			<div>
				<div style="
					display: flex;
					align-items: center;
					gap: 0.5rem;
					margin-bottom: 0.5rem;
				">
					<div style="
						width: 24px;
						height: 2px;
						background: linear-gradient(90deg, #00E5B8, transparent);
						border-radius: 1px;
					"></div>
					<span style="
						font-family: var(--font-display);
						font-size: 0.6875rem;
						font-weight: 700;
						letter-spacing: 0.12em;
						text-transform: uppercase;
						color: #00E5B8;
					">Innovation Portal</span>
				</div>
				<h1 style="
					font-family: var(--font-display);
					font-size: clamp(2rem, 4vw, 3rem);
					font-weight: 800;
					letter-spacing: -0.03em;
					color: var(--color-text-primary);
					line-height: 1;
					margin-bottom: 0.625rem;
				">
					Overview
				</h1>
				<p style="
					font-size: 1rem;
					color: var(--color-text-secondary);
					max-width: 46rem;
					line-height: 1.6;
				">
					Your at-a-glance view of emerging technologies, AI-generated ideas, and industry intelligence.
				</p>
			</div>
		</div>
	</section>

	<!-- Stats bar -->
	<section style="margin-bottom: 2.5rem;">
		<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;" class="sm:!grid-cols-4">
			<!-- Innovations -->
			<div style="
				position: relative;
				overflow: hidden;
				background: rgba(23, 32, 48, 0.88);
				border: 1px solid var(--color-border);
				border-radius: 14px;
				padding: 1.25rem 1.5rem;
				text-align: center;
			">
				<div style="
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					height: 2px;
					background: linear-gradient(90deg, #00E5B8, transparent);
				"></div>
				<div style="
					font-family: var(--font-display);
					font-size: 2.25rem;
					font-weight: 800;
					letter-spacing: -0.03em;
					background: linear-gradient(135deg, #00E5B8 0%, #93D9FF 100%);
					-webkit-background-clip: text;
					background-clip: text;
					-webkit-text-fill-color: transparent;
					line-height: 1;
					margin-bottom: 0.375rem;
				">{totalInnovations()}</div>
				<div style="
					font-family: var(--font-display);
					font-size: 0.625rem;
					font-weight: 700;
					letter-spacing: 0.1em;
					text-transform: uppercase;
					color: var(--color-text-muted);
				">Innovations</div>
			</div>

			<!-- Ideas -->
			<div style="
				position: relative;
				overflow: hidden;
				background: rgba(23, 32, 48, 0.88);
				border: 1px solid var(--color-border);
				border-radius: 14px;
				padding: 1.25rem 1.5rem;
				text-align: center;
			">
				<div style="
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					height: 2px;
					background: linear-gradient(90deg, #FFC842, transparent);
				"></div>
				<div style="
					font-family: var(--font-display);
					font-size: 2.25rem;
					font-weight: 800;
					letter-spacing: -0.03em;
					color: #FFC842;
					line-height: 1;
					margin-bottom: 0.375rem;
				">{data.ideas.length}</div>
				<div style="
					font-family: var(--font-display);
					font-size: 0.625rem;
					font-weight: 700;
					letter-spacing: 0.1em;
					text-transform: uppercase;
					color: var(--color-text-muted);
				">Ideas</div>
			</div>

			<!-- News -->
			<div style="
				position: relative;
				overflow: hidden;
				background: rgba(23, 32, 48, 0.88);
				border: 1px solid var(--color-border);
				border-radius: 14px;
				padding: 1.25rem 1.5rem;
				text-align: center;
			">
				<div style="
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					height: 2px;
					background: linear-gradient(90deg, #93D9FF, transparent);
				"></div>
				<div style="
					font-family: var(--font-display);
					font-size: 2.25rem;
					font-weight: 800;
					letter-spacing: -0.03em;
					color: #93D9FF;
					line-height: 1;
					margin-bottom: 0.375rem;
				">{data.news.length}</div>
				<div style="
					font-family: var(--font-display);
					font-size: 0.625rem;
					font-weight: 700;
					letter-spacing: 0.1em;
					text-transform: uppercase;
					color: var(--color-text-muted);
				">News</div>
			</div>

			<!-- Catalog -->
			<div style="
				position: relative;
				overflow: hidden;
				background: rgba(23, 32, 48, 0.88);
				border: 1px solid var(--color-border);
				border-radius: 14px;
				padding: 1.25rem 1.5rem;
				text-align: center;
			">
				<div style="
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					height: 2px;
					background: linear-gradient(90deg, #3EEAA8, transparent);
				"></div>
				<div style="
					font-family: var(--font-display);
					font-size: 2.25rem;
					font-weight: 800;
					letter-spacing: -0.03em;
					color: #3EEAA8;
					line-height: 1;
					margin-bottom: 0.375rem;
				">{data.catalogItems.length}</div>
				<div style="
					font-family: var(--font-display);
					font-size: 0.625rem;
					font-weight: 700;
					letter-spacing: 0.1em;
					text-transform: uppercase;
					color: var(--color-text-muted);
				">In Catalog</div>
			</div>
		</div>
	</section>

	<!-- Innovation Radar -->
	<section style="margin-bottom: 2.5rem;">
		<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
			<div style="display:flex; align-items:center; gap:0.75rem;">
				<div style="
					width: 32px;
					height: 32px;
					border-radius: 8px;
					background: rgba(184, 160, 255, 0.16);
					border: 1px solid rgba(184, 160, 255, 0.28);
					display: flex;
					align-items: center;
					justify-content: center;
				">
					<svg style="width:16px; height:16px; color:#B8A0FF;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				</div>
				<h2 style="
					font-family: var(--font-display);
					font-size: 1.125rem;
					font-weight: 700;
					letter-spacing: -0.01em;
					color: var(--color-text-primary);
				">Innovation Radar</h2>
			</div>
			<a href="{base}/innovations" style="
				display: flex;
				align-items: center;
				gap: 0.375rem;
				font-family: var(--font-display);
				font-size: 0.75rem;
				font-weight: 600;
				letter-spacing: 0.04em;
				text-transform: uppercase;
				color: #B8A0FF;
				text-decoration: none;
				transition: opacity 0.15s ease;
			">
				Browse all
				<svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
				</svg>
			</a>
		</div>
		<Card padding="lg" class="overflow-hidden">
			<RadarVisualization innovations={data.innovations} />
		</Card>
	</section>

	<!-- Two-column: Top Innovations + Latest News -->
	<div class="grid lg:grid-cols-5 gap-6" style="margin-bottom: 2.5rem;">

		<!-- Top Innovations -->
		<section class="lg:col-span-3">
			<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
				<div style="display:flex; align-items:center; gap:0.75rem;">
					<div style="
						width: 32px;
						height: 32px;
						border-radius: 8px;
				background: rgba(0, 229, 184, 0.14);
					border: 1px solid rgba(0, 229, 184, 0.25);
					display: flex;
					align-items: center;
					justify-content: center;
				">
					<svg style="width:16px; height:16px; color:#00E5B8;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
						</svg>
					</div>
					<h2 style="
						font-family: var(--font-display);
						font-size: 1.125rem;
						font-weight: 700;
						letter-spacing: -0.01em;
						color: var(--color-text-primary);
					">Top Innovations</h2>
				</div>
				<a href="{base}/innovations" style="
					display: flex;
					align-items: center;
					gap: 0.375rem;
					font-family: var(--font-display);
					font-size: 0.75rem;
					font-weight: 600;
					letter-spacing: 0.04em;
					text-transform: uppercase;
				color: #00E5B8;
				text-decoration: none;
			">
				View all
				<svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
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
				<div style="
			background: rgba(23, 32, 48, 0.88);
				border: 1px solid var(--color-border);
				border-radius: 14px;
				padding: 3rem 2rem;
				text-align: center;
			">
				<div style="
					width: 52px;
					height: 52px;
					margin: 0 auto 1rem;
						border-radius: 12px;
						background: rgba(255,255,255,0.04);
						border: 1px solid var(--color-border);
						display: flex;
						align-items: center;
						justify-content: center;
					">
						<svg style="width:24px; height:24px; color:var(--color-text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
						</svg>
					</div>
					<p style="font-size:0.875rem; color:var(--color-text-secondary);">No innovations published yet.</p>
				</div>
			{/if}
		</section>

		<!-- Latest News -->
		<section class="lg:col-span-2">
			<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
				<div style="display:flex; align-items:center; gap:0.75rem;">
					<div style="
						width: 32px;
						height: 32px;
						border-radius: 8px;
				background: rgba(147, 217, 255, 0.14);
					border: 1px solid rgba(147, 217, 255, 0.25);
					display: flex;
					align-items: center;
					justify-content: center;
				">
					<svg style="width:16px; height:16px; color:#93D9FF;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
						</svg>
					</div>
					<h2 style="
						font-family: var(--font-display);
						font-size: 1.125rem;
						font-weight: 700;
						letter-spacing: -0.01em;
						color: var(--color-text-primary);
					">Latest News</h2>
				</div>
				<a href="{base}/news" style="
					display: flex;
					align-items: center;
					gap: 0.375rem;
					font-family: var(--font-display);
					font-size: 0.75rem;
					font-weight: 600;
					letter-spacing: 0.04em;
					text-transform: uppercase;
				color: #93D9FF;
				text-decoration: none;
				">
					View all
					<svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
					</svg>
				</a>
			</div>

			{#if data.news.length > 0}
				<div style="display:flex; flex-direction:column; gap:0.75rem;">
					{#each data.news as item (item.id)}
						{@const deptColor = DEPARTMENT_COLORS[item.category as DepartmentCategory] ?? '#6B7280'}
						<a href="{base}/news/{item.slug}" class="group block animate-fade-in" style="text-decoration:none;">
							<div
							role="presentation"
							style="
							background: rgba(23, 32, 48, 0.88);
							border: 1px solid var(--color-border);
							border-radius: 12px;
							overflow: hidden;
							transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
							"
							onmouseenter={(e) => {
								const el = e.currentTarget as HTMLElement;
								el.style.borderColor = deptColor + '50';
								el.style.transform = 'translateY(-1px)';
								el.style.boxShadow = `0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px ${deptColor}25`;
							}}
							onmouseleave={(e) => {
								const el = e.currentTarget as HTMLElement;
								el.style.borderColor = 'var(--color-border)';
								el.style.transform = 'translateY(0)';
								el.style.boxShadow = 'none';
							}}
							>
								<!-- Colored accent bar -->
								<div style="height:2px; background:linear-gradient(90deg, {deptColor}AA, transparent);"></div>
								<div style="padding:0.875rem 1rem;">
									<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:0.5rem; margin-bottom:0.5rem;">
										<span style="
											display:inline-flex; align-items:center;
											border-radius:4px;
											border:1px solid;
											font-family:var(--font-display);
											font-weight:600;
											font-size:0.625rem;
											letter-spacing:0.06em;
											text-transform:uppercase;
											padding:0.125rem 0.4rem;
											flex-shrink:0;
										background:{deptColor}28;
										color:{deptColor};
										border-color:{deptColor}50;
										">
											{DEPARTMENT_LABELS[item.category as DepartmentCategory] ?? item.category}
										</span>
										{#if item.publishedAt}
											<span style="font-size:0.6875rem; color:var(--color-text-muted); flex-shrink:0;">{formatDate(item.publishedAt)}</span>
										{/if}
									</div>
									<h3 style="
										font-family:var(--font-display);
										font-size:0.875rem;
										font-weight:700;
										color:var(--color-text-primary);
										display:-webkit-box;
										-webkit-line-clamp:2;
										-webkit-box-orient:vertical;
										overflow:hidden;
										margin-bottom:0.375rem;
										letter-spacing:-0.01em;
										line-height:1.4;
										transition:color 0.15s ease;
									" class="group-hover:!text-sky-300">
										{item.title}
									</h3>
									<p style="
										font-size:0.8125rem;
										color:var(--color-text-secondary);
										display:-webkit-box;
										-webkit-line-clamp:2;
										-webkit-box-orient:vertical;
										overflow:hidden;
										margin-bottom:0.5rem;
										line-height:1.5;
									">
										{item.summary}
									</p>
									{#if item.relevanceScore !== null}
										<div style="display:flex; align-items:center; gap:0.5rem;">
											<div style="flex:1; height:3px; background:rgba(255,255,255,0.10); border-radius:99px; overflow:hidden;">
												<div style="
													height:100%; border-radius:99px;
													width:{getScoreWidth(item.relevanceScore)};
													background:linear-gradient(90deg, #3B9EFF, #818CF8);
													transition:width 0.5s ease;
												"></div>
											</div>
											<span style="font-size:0.6875rem; font-family:var(--font-display); font-weight:700; {getScoreColor(item.relevanceScore)}; font-variant-numeric:tabular-nums;">
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
				<div style="
				background: rgba(23, 32, 48, 0.88);
				border: 1px solid var(--color-border);
				border-radius: 14px;
				padding: 3rem 2rem;
				text-align: center;
			">
				<p style="font-size:0.875rem; color:var(--color-text-secondary);">No news published yet.</p>
				</div>
			{/if}
		</section>
	</div>

	<!-- Ideas Spotlight -->
	<section style="margin-bottom: 2.5rem;">
		<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
			<div style="display:flex; align-items:center; gap:0.75rem;">
				<div style="
					width: 32px;
					height: 32px;
					border-radius: 8px;
					background: rgba(255, 200, 66, 0.14);
					border: 1px solid rgba(255, 200, 66, 0.25);
					display: flex;
					align-items: center;
					justify-content: center;
				">
					<svg style="width:16px; height:16px; color:#FFC842;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
				</div>
				<h2 style="
					font-family: var(--font-display);
					font-size: 1.125rem;
					font-weight: 700;
					letter-spacing: -0.01em;
					color: var(--color-text-primary);
				">Top Ideas</h2>
				<span style="
					display:inline-flex; align-items:center;
				padding:0.125rem 0.5rem;
				border-radius:4px;
				background:rgba(255,200,66,0.15);
				border:1px solid rgba(255,200,66,0.32);
				font-family:var(--font-display);
				font-size:0.6rem;
				font-weight:700;
				letter-spacing:0.06em;
				text-transform:uppercase;
				color:#FFC842;
				">AI-generated</span>
			</div>
			<a href="{base}/ideas" style="
				display: flex;
				align-items: center;
				gap: 0.375rem;
				font-family: var(--font-display);
				font-size: 0.75rem;
				font-weight: 600;
				letter-spacing: 0.04em;
				text-transform: uppercase;
				color: #FFC842;
				text-decoration: none;
			">
				View all
				<svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
				</svg>
			</a>
		</div>

		{#if data.ideas.length > 0}
			<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each data.ideas as idea, i (idea.id)}
					{@const deptColor = DEPARTMENT_COLORS[idea.department as DepartmentCategory] ?? '#6B7280'}
					<a href="{base}/ideas/{idea.slug}" class="group block animate-fade-in" style="text-decoration:none;">
						<div
						role="presentation"
						style="
						background: rgba(23, 32, 48, 0.88);
						border: 1px solid var(--color-border);
						border-radius: 14px;
						overflow: hidden;
						height: 100%;
						display: flex;
						flex-direction: column;
						transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
					"
					onmouseenter={(e) => {
						const el = e.currentTarget as HTMLElement;
						el.style.borderColor = '#FFC84255';
						el.style.transform = 'translateY(-2px)';
						el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,200,66,0.20)';
					}}
						onmouseleave={(e) => {
							const el = e.currentTarget as HTMLElement;
							el.style.borderColor = 'var(--color-border)';
							el.style.transform = 'translateY(0)';
							el.style.boxShadow = 'none';
						}}
						>
							<!-- Gradient header -->
							<div class="relative h-20 bg-gradient-to-br {getDepartmentGradient(idea.department)} flex items-center justify-center overflow-hidden" style="flex-shrink:0; position:relative;">
								<!-- Rank watermark -->
								<span style="
									position:absolute; right:0.75rem; bottom:0.25rem;
									font-family:var(--font-display);
									font-size:3rem;
									font-weight:900;
									color:rgba(255,255,255,0.07);
									line-height:1;
									user-select:none;
								">#{i + 1}</span>
								<!-- Icon -->
								<svg style="width:2rem; height:2rem; color:rgba(255,255,255,0.35);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
								</svg>
								<!-- Dept badge -->
								<div style="position:absolute; top:0.5rem; left:0.5rem;">
									<span style="
										display:inline-flex; align-items:center;
										border-radius:4px; border:1px solid;
										font-family:var(--font-display); font-size:0.6rem;
										font-weight:700; letter-spacing:0.06em; text-transform:uppercase;
										padding:0.1rem 0.375rem;
										background:{deptColor}35; color:white; border-color:{deptColor}55;
									">
										{DEPARTMENT_LABELS[idea.department as DepartmentCategory] ?? idea.department}
									</span>
								</div>
								<!-- Vote count -->
								{#if idea.voteCount > 0}
									<div style="
										position:absolute; top:0.5rem; right:0.5rem;
										display:flex; align-items:center; gap:0.25rem;
										background:rgba(0,0,0,0.35); border-radius:99px;
										padding:0.125rem 0.5rem;
									">
										<svg style="width:10px; height:10px; color:#FFC842;" fill="currentColor" viewBox="0 0 24 24">
											<path d="M5 15l7-7 7 7H5z" />
										</svg>
										<span style="font-size:0.6875rem; color:white; font-weight:700; font-family:var(--font-display);">{idea.voteCount}</span>
									</div>
								{/if}
								<!-- Bottom accent line -->
								<div style="position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg, {deptColor}50, transparent);"></div>
							</div>

							<!-- Content -->
							<div style="padding:0.875rem; flex:1; display:flex; flex-direction:column;">
								<h3 style="
									font-family:var(--font-display);
									font-size:0.875rem;
									font-weight:700;
									color:var(--color-text-primary);
									display:-webkit-box;
									-webkit-line-clamp:2;
									-webkit-box-orient:vertical;
									overflow:hidden;
									margin-bottom:0.375rem;
									letter-spacing:-0.01em;
									line-height:1.4;
									transition:color 0.15s ease;
								" class="group-hover:!text-amber-300">
									{idea.title}
								</h3>
								<p style="
									font-size:0.75rem;
									color:var(--color-text-secondary);
									display:-webkit-box;
									-webkit-line-clamp:2;
									-webkit-box-orient:vertical;
									overflow:hidden;
									margin-bottom:0.75rem;
									flex:1;
									line-height:1.5;
								">
									{idea.summary}
								</p>

								{#if idea.evaluationScore !== null}
									<div>
										<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.25rem;">
											<span style="font-family:var(--font-display); font-size:0.6rem; letter-spacing:0.06em; text-transform:uppercase; color:var(--color-text-muted); font-weight:700;">Eval. Score</span>
											<span style="font-family:var(--font-display); font-size:0.6875rem; font-weight:700; color:#FFC842;">{idea.evaluationScore.toFixed(1)}</span>
										</div>
									<div style="height:3px; background:rgba(255,255,255,0.10); border-radius:99px; overflow:hidden;">
										<div style="
											height:100%; border-radius:99px;
											width:{getScoreWidth(idea.evaluationScore)};
											background:linear-gradient(90deg, #FFC842, #FF5C6B);
											"></div>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<div style="
				background: rgba(23, 32, 48, 0.88);
				border: 1px solid var(--color-border);
				border-radius: 14px;
				padding: 3rem 2rem;
				text-align: center;
			">
				<p style="font-size:0.875rem; color:var(--color-text-secondary);">No ideas published yet.</p>
			</div>
		{/if}
	</section>

	<!-- Category Filter Pills -->
	<section style="margin-bottom: 2.5rem;">
		<div style="
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-bottom: 0.875rem;
		">
			<div style="width:16px; height:1px; background:linear-gradient(90deg, #00E5B8, transparent);"></div>
			<span style="
				font-family:var(--font-display);
				font-size:0.625rem;
				font-weight:700;
				letter-spacing:0.12em;
				text-transform:uppercase;
				color:var(--color-text-muted);
			">Browse by Category</span>
		</div>
		<div style="display:flex; flex-wrap:wrap; gap:0.5rem;">
			{#each categories as [category, label]}
				<a href="{base}/innovations?category={category}" class="group" style="text-decoration:none;">
					<Badge variant="category" {category} size="md">
						{label}
						{#if data.categoryCounts[category]}
							<span style="margin-left:0.375rem; opacity:0.55;">({data.categoryCounts[category]})</span>
						{/if}
					</Badge>
				</a>
			{/each}
		</div>
	</section>

	<!-- Catalog Ready to Try -->
	{#if data.catalogItems && data.catalogItems.length > 0}
		<section style="margin-bottom: 1rem;">
			<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; flex-wrap:wrap; gap:0.5rem;">
				<div style="display:flex; align-items:center; gap:0.75rem;">
					<div style="
						width: 32px;
						height: 32px;
						border-radius: 8px;
				background: rgba(62, 234, 168, 0.14);
					border: 1px solid rgba(62, 234, 168, 0.25);
					display: flex;
					align-items: center;
					justify-content: center;
				">
					<svg style="width:16px; height:16px; color:#3EEAA8;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
						</svg>
					</div>
					<h2 style="
						font-family: var(--font-display);
						font-size: 1.125rem;
						font-weight: 700;
						letter-spacing: -0.01em;
						color: var(--color-text-primary);
					">Ready to Try</h2>
				</div>
				<a href="{base}/catalog" style="
					display: flex;
					align-items: center;
					gap: 0.375rem;
					font-family: var(--font-display);
					font-size: 0.75rem;
					font-weight: 600;
					letter-spacing: 0.04em;
					text-transform: uppercase;
				color: #3EEAA8;
				text-decoration: none;
			">
				View all
					<svg style="width:12px; height:12px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
					</svg>
				</a>
			</div>

			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{#each data.catalogItems as item (item.id)}
					<a href="{base}/catalog/{item.slug}" class="group block animate-fade-in" style="text-decoration:none;">
						<div
						role="presentation"
						style="
						background: rgba(23, 32, 48, 0.88);
						border: 1px solid var(--color-border);
						border-radius: 14px;
						padding: 1rem 1.125rem;
						height: 100%;
						display: flex;
						flex-direction: column;
						transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
					"
					onmouseenter={(e) => {
						const el = e.currentTarget as HTMLElement;
						el.style.borderColor = 'rgba(62, 234, 168, 0.40)';
						el.style.transform = 'translateY(-2px)';
						el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(62,234,168,0.20)';
						}}
						onmouseleave={(e) => {
							const el = e.currentTarget as HTMLElement;
							el.style.borderColor = 'var(--color-border)';
							el.style.transform = 'translateY(0)';
							el.style.boxShadow = 'none';
						}}
						>
							<div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
								{#if item.iconUrl}
									<img src={item.iconUrl} alt={item.name} style="width:40px; height:40px; border-radius:10px; object-fit:cover; border:1px solid var(--color-border);" />
								{:else}
									<div style="
										width:40px; height:40px; border-radius:10px; flex-shrink:0;
								background:rgba(62,234,168,0.14);
									border:1px solid rgba(62,234,168,0.28);
									display:flex; align-items:center; justify-content:center;
								">
									<svg style="width:20px; height:20px; color:#3EEAA8;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
										</svg>
									</div>
								{/if}
								<div style="flex:1; min-width:0;">
									<h3 style="
										font-family:var(--font-display);
										font-size:0.875rem;
										font-weight:700;
										color:var(--color-text-primary);
										overflow:hidden;
										text-overflow:ellipsis;
										white-space:nowrap;
										transition:color 0.15s ease;
									" class="group-hover:!text-emerald-300">{item.name}</h3>
									<Badge variant="category" category={item.category} size="sm">{item.category}</Badge>
								</div>
							</div>
							<p style="
								font-size:0.8125rem;
								color:var(--color-text-secondary);
								display:-webkit-box;
								-webkit-line-clamp:2;
								-webkit-box-orient:vertical;
								overflow:hidden;
								flex:1;
								line-height:1.5;
							">{item.description}</p>
							<div style="
								margin-top:0.75rem;
								padding-top:0.75rem;
								border-top:1px solid var(--color-border);
								display:flex;
								align-items:center;
								justify-content:space-between;
							">
							<span style="display:inline-flex; align-items:center; gap:0.375rem; font-size:0.75rem; color:#3EEAA8; font-family:var(--font-display); font-weight:600;">
								<span style="width:6px; height:6px; border-radius:50%; background:#3EEAA8; display:block;"></span>
									Active
								</span>
								<span style="
									font-size:0.6875rem;
									color:var(--color-text-muted);
									font-family:var(--font-display);
									font-weight:600;
									letter-spacing:0.04em;
									text-transform:uppercase;
									transition:color 0.15s ease;
								" class="group-hover:!text-emerald-400">Try it →</span>
							</div>
						</div>
					</a>
				{/each}
			</div>
		</section>
	{/if}

</div>
