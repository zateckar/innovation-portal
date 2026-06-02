<script lang="ts">
	import { base } from '$app/paths';
	import type { InnovationSummary, MaturityLevel } from '$lib/types';
	import { CATEGORY_LABELS, CATEGORY_COLORS, DEPARTMENT_LABELS, DEPARTMENT_COLORS } from '$lib/types';
	import VoteButton from './VoteButton.svelte';

	interface Props {
		innovation: InnovationSummary;
		showVote?: boolean;
	}

	let { innovation, showVote = true }: Props = $props();

	const accent = $derived(CATEGORY_COLORS[innovation.category]);

	const maturityInfo: Record<MaturityLevel, { label: string; color: string }> = {
		experimental: { label: 'Experimental', color: '#A78BFA' },
		beta:         { label: 'Beta',         color: '#FAB93A' },
		stable:       { label: 'Stable',       color: '#3EEAA8' },
		mature:       { label: 'Mature',       color: '#22D3EE' }
	};

	const maturityMeta = $derived(
		innovation.maturityLevel ? maturityInfo[innovation.maturityLevel] : null
	);

	const deptLabel = $derived(
		innovation.department
			? (DEPARTMENT_LABELS[innovation.department] ?? innovation.department)
			: null
	);

	const relevancePct = $derived(
		innovation.relevanceScore === null ? null : Math.round(innovation.relevanceScore * 10)
	);

	const actionPct = $derived(
		innovation.actionabilityScore === null ? null : Math.round(innovation.actionabilityScore * 10)
	);
</script>

<a
	href="{base}/innovations/{innovation.slug}"
	class="list-card list-card--software group block"
	style="text-decoration: none;"
>
	<div class="list-card__identity">
		<div class="list-card__identity-pattern"></div>
		{#if innovation.heroImageUrl}
			<img
				src={innovation.heroImageUrl}
				alt={innovation.title}
				style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0.45; z-index:0;"
			/>
		{/if}
		<svg
			class="list-card__icon"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			style={innovation.heroImageUrl ? 'position:relative; z-index:1; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));' : ''}
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
			/>
		</svg>
		<span class="list-card__type-label" style={innovation.heroImageUrl ? 'position:relative; z-index:1;' : ''}>Software</span>
	</div>

	<div class="list-card__body">
		<div class="list-card__chips">
			<span
				class="list-card__chip"
				style="--chip-bg: {accent}1A; --chip-fg: {accent}; --chip-border: {accent}55;"
			>
				<span class="list-card__chip-dot"></span>
				{CATEGORY_LABELS[innovation.category]}
			</span>
			{#if deptLabel}
				<span
					class="list-card__chip"
					style="--chip-bg: {DEPARTMENT_COLORS[innovation.department!]}1A; --chip-fg: {DEPARTMENT_COLORS[innovation.department!]}; --chip-border: {DEPARTMENT_COLORS[innovation.department!]}55;"
				>
					{deptLabel}
				</span>
			{/if}
			{#if maturityMeta}
				<span
					class="list-card__chip"
					style="--chip-bg: {maturityMeta.color}1A; --chip-fg: {maturityMeta.color}; --chip-border: {maturityMeta.color}55;"
				>
					{maturityMeta.label}
				</span>
			{/if}
			{#if innovation.hasAiComponent}
				<span
					class="list-card__chip"
					style="--chip-bg: rgba(167,139,250,0.15); --chip-fg: #B8A0FF; --chip-border: rgba(167,139,250,0.45);"
				>
					AI
				</span>
			{/if}
			{#if innovation.isOpenSource}
				<span
					class="list-card__chip"
					style="--chip-bg: rgba(0,229,184,0.15); --chip-fg: #00E5B8; --chip-border: rgba(0,229,184,0.45);"
				>
					OSS
				</span>
			{/if}
			{#if innovation.isSelfHosted}
				<span
					class="list-card__chip"
					style="--chip-bg: rgba(147,217,255,0.15); --chip-fg: #93D9FF; --chip-border: rgba(147,217,255,0.45);"
				>
					Self-host
				</span>
			{/if}
		</div>

		<h3 class="list-card__title">{innovation.title}</h3>
		<p class="list-card__summary">{innovation.tagline}</p>

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
			{#if actionPct !== null}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Actionability</span>
					<div class="flex items-center gap-2">
						<div class="list-card__meta-bar">
							<div class="list-card__meta-bar-fill" style="width: {actionPct}%;"></div>
						</div>
						<span class="list-card__meta-value list-card__meta-value--accent"
							>{actionPct}%</span
						>
					</div>
				</div>
			{/if}
			{#if showVote}
				<div class="list-card__meta-item" style="margin-left: auto;">
					<span class="list-card__meta-label">Votes</span>
					<VoteButton
						innovationId={innovation.id}
						voteCount={innovation.voteCount}
						hasVoted={innovation.hasVoted}
						size="sm"
					/>
				</div>
			{:else}
				<span class="list-card__arrow" aria-hidden="true">
					<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
					</svg>
				</span>
			{/if}
		</div>
	</div>
</a>
