<script lang="ts">
	import { base } from '$app/paths';
	import type { TrendSummary, TrendMaturityLevel, DepartmentCategory } from '$lib/types';
	import {
		TREND_CATEGORIES,
		MATURITY_LABELS,
		MATURITY_COLORS,
		DEPARTMENT_LABELS,
		DEPARTMENT_COLORS
	} from '$lib/types';

	interface Props {
		trend: TrendSummary;
	}

	let { trend }: Props = $props();

	const catMeta = $derived(TREND_CATEGORIES[trend.category] ?? {
		label: trend.category,
		group: trend.categoryGroup,
		icon: '📊',
		color: '#FF7D55'
	});

	// Department uses the same DEPARTMENT_LABELS / DEPARTMENT_COLORS as ideas and news so
	// the chip looks identical across the app (single source of truth in $lib/types).
	const deptMeta = $derived(
		trend.department
			? {
					label: DEPARTMENT_LABELS[trend.department as DepartmentCategory] ?? trend.department,
					color: DEPARTMENT_COLORS[trend.department as DepartmentCategory] ?? DEPARTMENT_COLORS.general
				}
			: null
	);

	const maturityMeta = $derived(
		trend.maturityLevel
			? {
					label: MATURITY_LABELS[trend.maturityLevel],
					color: MATURITY_COLORS[trend.maturityLevel as TrendMaturityLevel]
				}
			: null
	);

	const horizonLabel = $derived(
		trend.timeHorizon
			? trend.timeHorizon.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
			: null
	);

	const impactPct = $derived(
		trend.impactScore === null ? null : Math.round(trend.impactScore * 100)
	);

	const formattedDate = $derived(
		trend.publishedAt
			? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
					new Date(trend.publishedAt)
				)
			: null
	);
</script>

<a
	href="{base}/trends/{trend.slug}"
	class="list-card list-card--trend group block"
	style="text-decoration: none;"
>
	<div class="list-card__identity">
		<div class="list-card__identity-pattern"></div>
		<svg class="list-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
			/>
		</svg>
		<span class="list-card__type-label">Trend</span>
	</div>

	<div class="list-card__body">
		<div class="list-card__chips">
			{#if deptMeta}
				<span
					class="list-card__chip"
					style="--chip-bg: {deptMeta.color}1A; --chip-fg: {deptMeta.color}; --chip-border: {deptMeta.color}55;"
				>
					<span class="list-card__chip-dot"></span>
					{deptMeta.label}
				</span>
			{/if}
			<span
				class="list-card__chip"
				style="--chip-bg: {catMeta.color}1A; --chip-fg: {catMeta.color}; --chip-border: {catMeta.color}55;"
			>
				{catMeta.label}
			</span>
			{#if maturityMeta}
				<span
					class="list-card__chip"
					style="--chip-bg: {maturityMeta.color}1A; --chip-fg: {maturityMeta.color}; --chip-border: {maturityMeta.color}55;"
				>
					{maturityMeta.label}
				</span>
			{/if}
		</div>

		<h3 class="list-card__title">{trend.title}</h3>
		<p class="list-card__summary">{trend.summary}</p>

		<div class="list-card__meta">
			{#if impactPct !== null}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Impact</span>
					<div class="flex items-center gap-2">
						<div class="list-card__meta-bar">
							<div class="list-card__meta-bar-fill" style="width: {impactPct}%;"></div>
						</div>
						<span class="list-card__meta-value list-card__meta-value--accent"
							>{impactPct}%</span
						>
					</div>
				</div>
			{/if}
			{#if horizonLabel}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Horizon</span>
					<span class="list-card__meta-value">{horizonLabel}</span>
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
