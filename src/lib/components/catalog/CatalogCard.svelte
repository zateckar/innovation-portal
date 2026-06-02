<script lang="ts">
	import { base } from '$app/paths';
	import type { CatalogItemSummary, CatalogItemStatus } from '$lib/types';
	import {
		CATEGORY_LABELS,
		CATEGORY_COLORS,
		DEPARTMENT_LABELS,
		DEPARTMENT_COLORS,
		CATALOG_STATUS_LABELS,
		CATALOG_STATUS_COLORS
	} from '$lib/types';

	interface Props {
		item: CatalogItemSummary;
	}

	let { item }: Props = $props();

	const statusInfo: Record<CatalogItemStatus, { label: string; color: string }> = {
		active:      { label: CATALOG_STATUS_LABELS.active,      color: CATALOG_STATUS_COLORS.active },
		maintenance: { label: CATALOG_STATUS_LABELS.maintenance, color: CATALOG_STATUS_COLORS.maintenance },
		archived:    { label: CATALOG_STATUS_LABELS.archived,    color: CATALOG_STATUS_COLORS.archived }
	};

	const statusMeta = $derived(statusInfo[item.status] ?? statusInfo.active);
	const deptLabel = $derived(
		item.department
			? (DEPARTMENT_LABELS[item.department] ?? item.department)
			: null
	);
</script>

<a
	href="{base}/catalog/{item.slug}"
	class="list-card list-card--catalog group block"
	style="text-decoration: none;"
>
	<div class="list-card__identity">
		<div class="list-card__identity-pattern"></div>
		{#if item.iconUrl}
			<img
				src={item.iconUrl}
				alt={item.name}
				style="position:absolute; inset:0; width:100%; height:100%; object-fit:contain; padding:1.25rem; opacity:0.85; z-index:0;"
			/>
		{:else}
			<svg
				class="list-card__icon"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
		{/if}
		<span
			class="list-card__type-label"
			style={item.iconUrl
				? 'position:absolute; bottom:0.5rem; left:0; right:0; text-align:center; background:rgba(6,41,31,0.75); padding:0.125rem 0; backdrop-filter:blur(4px); z-index:1;'
				: ''}>Catalog</span
		>
	</div>

	<div class="list-card__body">
		<div class="list-card__chips">
			<span
				class="list-card__chip"
				style="--chip-bg: {CATEGORY_COLORS[item.category]}1A; --chip-fg: {CATEGORY_COLORS[item.category]}; --chip-border: {CATEGORY_COLORS[item.category]}55;"
			>
				<span class="list-card__chip-dot"></span>
				{CATEGORY_LABELS[item.category]}
			</span>
			{#if deptLabel}
				<span
					class="list-card__chip"
					style="--chip-bg: {DEPARTMENT_COLORS[item.department!]}1A; --chip-fg: {DEPARTMENT_COLORS[item.department!]}; --chip-border: {DEPARTMENT_COLORS[item.department!]}55;"
				>
					{deptLabel}
				</span>
			{/if}
			<span
				class="list-card__chip"
				style="--chip-bg: {statusMeta.color}1A; --chip-fg: {statusMeta.color}; --chip-border: {statusMeta.color}55;"
			>
				{statusMeta.label}
			</span>
		</div>

		<h3 class="list-card__title">{item.name}</h3>
		<p class="list-card__summary">{item.description}</p>

		<div class="list-card__meta">
			{#if item.innovationId}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Provenance</span>
					<span class="list-card__meta-value list-card__meta-value--accent">
						Promoted from Radar
					</span>
				</div>
			{:else}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Type</span>
					<span class="list-card__meta-value">External tool</span>
				</div>
			{/if}
			<div class="list-card__meta-item">
				<span class="list-card__meta-label">Action</span>
				<span class="list-card__meta-value list-card__meta-value--accent">Try it</span>
			</div>
			<span class="list-card__arrow" aria-hidden="true">
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</span>
		</div>
	</div>
</a>
