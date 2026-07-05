<script lang="ts">
	import { base } from '$app/paths';
	import type { IdeaSummary, DepartmentCategory } from '$lib/types';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS } from '$lib/types';

	interface Props {
		idea: IdeaSummary;
		voteThreshold?: number;
		/** Which development bucket this card is rendered in (from the list tabs). */
		stage?: 'in_progress' | 'building' | 'deployed';
	}

	let { idea, stage = 'in_progress' }: Props = $props();

	const accent = $derived(DEPARTMENT_COLORS[idea.department] ?? DEPARTMENT_COLORS.general);
	const deptLabel = $derived(DEPARTMENT_LABELS[idea.department] ?? idea.department);

	const isSpecReady = $derived(idea.specStatus === 'completed');
	const isPromoted = $derived(!!idea.productionJiraKey);
	const hasParticipated = $derived(!!(idea as IdeaSummary & { hasParticipated?: boolean }).hasParticipated);

	// Build-stage chip: reflects the actual bucket the card lives in so it matches
	// reality (a deployed app reads "Built"; a finished spec reads "Ready").
	// Colours come from the design-system tokens via the list-card CSS variables
	// so the card picks up the dept palette on hover (border + glow + arrow tint).
	const stageMeta = $derived(
		isPromoted
			? { label: 'Deployment Requested', color: '#38BDF8' }
			: stage === 'deployed'
				? { label: 'Built', color: '#10B981' }
				: stage === 'building'
					? { label: 'Building', color: '#38BDF8' }
					: isSpecReady
						? { label: 'Ready', color: '#10B981' }
						: { label: 'In Progress', color: '#F59E0B' }
	);
</script>

<a
	href="{base}/development/{idea.slug}"
	class="list-card group"
	style="--card-accent: {accent}; --card-accent-contrast: {DEPARTMENT_COLORS.general === accent ? '#0a0f1a' : '#0a0f1a'}; --card-accent-soft: {accent}2E; --card-accent-glow: {accent}1A; text-decoration: none;"
>
	<div class="list-card__identity" style="background: linear-gradient(160deg, {accent}33, {accent}0A); color: {accent};">
		<div class="list-card__identity-pattern" style="opacity: 0.35;"></div>
		<svg class="list-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
			/>
		</svg>
		<span class="list-card__type-label">In Dev</span>
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
			<span
				class="list-card__chip"
				style="--chip-bg: {stageMeta.color}1A; --chip-fg: {stageMeta.color}; --chip-border: {stageMeta.color}55;"
			>
				<span class="list-card__chip-dot"></span>
				{stageMeta.label}
			</span>
			{#if hasParticipated}
				<span
					class="list-card__chip"
					style="--chip-bg: #10B9811A; --chip-fg: #10B981; --chip-border: #10B98155;"
				>
					You contributed
				</span>
			{/if}
		</div>

		<h3 class="list-card__title">{idea.title}</h3>
		<p class="list-card__summary">{idea.summary}</p>

		<div class="list-card__meta">
			<div class="list-card__meta-item">
				<span class="list-card__meta-label">Votes</span>
				<span class="list-card__meta-value list-card__meta-value--accent">
					{idea.voteCount}
				</span>
			</div>
			{#if idea.specStatus && idea.specStatus !== 'not_started'}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Spec</span>
					<span class="list-card__meta-value">
						{idea.specStatus === 'completed' ? 'Ready' : 'In progress'}
					</span>
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
