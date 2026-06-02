<script lang="ts">
	import { base } from '$app/paths';
	import type { IdeaSummary, IdeaStatus } from '$lib/types';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS } from '$lib/types';

	interface Props {
		idea: IdeaSummary;
		// Kept for backwards-compatible call sites (no longer used).
		showVote?: boolean;
		voteThreshold?: number;
	}

	let { idea }: Props = $props();

	const accent = $derived(DEPARTMENT_COLORS[idea.department] ?? DEPARTMENT_COLORS.general);
	const deptLabel = $derived(DEPARTMENT_LABELS[idea.department] ?? idea.department);

	const statusInfo: Record<IdeaStatus, { label: string; color: string }> = {
		draft:     { label: 'Draft',     color: '#94A3B8' },
		evaluated: { label: 'Evaluated', color: '#FAB93A' },
		realized:  { label: 'Realized',  color: '#FFC842' },
		published: { label: 'Published', color: '#3EEAA8' },
		archived:  { label: 'Archived',  color: '#64748B' }
	};

	const statusMeta = $derived(statusInfo[idea.status] ?? statusInfo.draft);

	const sourceMeta = $derived(
		idea.source === 'user'
			? { label: 'User', color: '#93D9FF' }
			: idea.source === 'jira'
				? { label: 'Jira', color: '#818CF8' }
				: { label: 'AI', color: '#A78BFA' }
	);

	const scorePct = $derived(
		idea.evaluationScore === null ? null : Math.round(idea.evaluationScore * 10)
	);
</script>

<a
	href="{base}/ideas/{idea.slug}"
	class="list-card list-card--idea group block"
	style="text-decoration: none;"
>
	<div class="list-card__identity">
		<div class="list-card__identity-pattern"></div>
		<svg class="list-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
			/>
		</svg>
		<span class="list-card__type-label">Idea</span>
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
				style="--chip-bg: {statusMeta.color}1A; --chip-fg: {statusMeta.color}; --chip-border: {statusMeta.color}55;"
			>
				{statusMeta.label}
			</span>
			<span
				class="list-card__chip"
				style="--chip-bg: {sourceMeta.color}1A; --chip-fg: {sourceMeta.color}; --chip-border: {sourceMeta.color}55;"
			>
				{sourceMeta.label}
			</span>
		</div>

		<h3 class="list-card__title">
			{#if idea.rank !== null}
				<span style="color: var(--color-text-muted); font-weight: 500; margin-right: 0.35rem;"
					>#{idea.rank}</span
				>
			{/if}
			{idea.title}
		</h3>
		<p class="list-card__summary">{idea.summary}</p>

		<div class="list-card__meta">
			{#if scorePct !== null}
				<div class="list-card__meta-item">
					<span class="list-card__meta-label">Score</span>
					<div class="flex items-center gap-2">
						<div class="list-card__meta-bar">
							<div class="list-card__meta-bar-fill" style="width: {scorePct}%;"></div>
						</div>
						<span class="list-card__meta-value list-card__meta-value--accent"
							>{scorePct}%</span
						>
					</div>
				</div>
			{/if}
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
