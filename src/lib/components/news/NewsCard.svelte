<script lang="ts">
	import { base } from '$app/paths';
	import type { NewsSummary, DepartmentCategory } from '$lib/types';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS } from '$lib/types';

	interface Props {
		newsItem: NewsSummary;
	}

	let { newsItem }: Props = $props();

	const accent = $derived(DEPARTMENT_COLORS[newsItem.category as DepartmentCategory] ?? DEPARTMENT_COLORS.general);
	const deptLabel = $derived(DEPARTMENT_LABELS[newsItem.category as DepartmentCategory] ?? newsItem.category);

	const relevancePct = $derived(
		newsItem.relevanceScore === null ? null : Math.round(newsItem.relevanceScore * 10)
	);

	const formattedDate = $derived(
		newsItem.publishedAt
			? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
					new Date(newsItem.publishedAt)
				)
			: null
	);
</script>

<a
	href="{base}/news/{newsItem.slug}"
	class="list-card list-card--news group block"
	style="text-decoration: none;"
>
	<div class="list-card__identity">
		<div class="list-card__identity-pattern"></div>
		<svg class="list-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
			/>
		</svg>
		<span class="list-card__type-label">News</span>
	</div>

	<div class="list-card__body">
		<div class="list-card__chips">
			<span
				class="list-card__chip"
				style="--chip-bg: {accent}1A; --chip-fg: {accent}; --chip-border: {accent}55;"
			>
				<span class="list-card__chip-dot"></span>
				{deptLabel}
			</span>
		</div>

		<h3 class="list-card__title">{newsItem.title}</h3>
		<p class="list-card__summary">{newsItem.summary}</p>

		<div class="list-card__meta">
			{#if relevancePct !== null}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Relevance</span>
					<div class="flex items-center gap-2">
						<div class="list-card__meta-bar">
							<div class="list-card__meta-bar-fill" style="width: {relevancePct}%;"></div>
						</div>
						<span class="list-card__meta-value list-card__meta-value--accent"
							>{relevancePct}%</span
						>
					</div>
				</div>
			{/if}
			{#if formattedDate}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Published</span>
					<span class="list-card__meta-value">{formattedDate}</span>
				</div>
			{/if}
			<span class="list-card__arrow" aria-hidden="true">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</span>
		</div>
	</div>
</a>
