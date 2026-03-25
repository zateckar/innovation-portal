<script lang="ts">
	import { base } from '$app/paths';
	import SpecProgressBar from './SpecProgressBar.svelte';
	import type { IdeaSummary, DepartmentCategory } from '$lib/types';
	import { DEPARTMENT_LABELS } from '$lib/types';

	interface Props {
		idea: IdeaSummary;
		voteThreshold?: number;
	}

	let { idea, voteThreshold = 5 }: Props = $props();

	// Static lookup — all class strings must be fully written out for Tailwind
	function getDeptClasses(dept: string): { badge: string; gradient: string } {
		const map: Record<string, { badge: string; gradient: string }> = {
			rd:         { badge: 'bg-purple-500/15 text-purple-300 border-purple-500/25',   gradient: 'from-purple-600/20 to-purple-900/20' },
			production: { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25',      gradient: 'from-amber-600/20 to-amber-900/20' },
			hr:         { badge: 'bg-pink-500/15 text-pink-300 border-pink-500/25',          gradient: 'from-pink-600/20 to-pink-900/20' },
			legal:      { badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',    gradient: 'from-indigo-600/20 to-indigo-900/20' },
			finance:    { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', gradient: 'from-emerald-600/20 to-emerald-900/20' },
			it:         { badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',          gradient: 'from-cyan-600/20 to-cyan-900/20' },
			purchasing: { badge: 'bg-red-500/15 text-red-300 border-red-500/25',             gradient: 'from-red-600/20 to-red-900/20' },
			quality:    { badge: 'bg-lime-500/15 text-lime-300 border-lime-500/25',          gradient: 'from-lime-600/20 to-lime-900/20' },
			logistics:  { badge: 'bg-orange-500/15 text-orange-300 border-orange-500/25',    gradient: 'from-orange-600/20 to-orange-900/20' },
			general:    { badge: 'bg-gray-500/15 text-gray-300 border-gray-500/25',          gradient: 'from-gray-600/20 to-gray-900/20' }
		};
		return map[dept] ?? map.general;
	}

	let deptClasses = $derived(getDeptClasses(idea.department));
	let deptLabel = $derived(DEPARTMENT_LABELS[idea.department as DepartmentCategory] ?? idea.department);
	let isUnderReview = $derived((idea.specReviewStatus ?? 'not_ready') === 'under_review');
	let hasParticipated = $derived(!!(idea as IdeaSummary & { hasParticipated?: boolean }).hasParticipated);
</script>

<a
	href="{base}/development/{idea.slug}"
	class="group flex flex-col gap-4 rounded-2xl border border-white/10 bg-bg-elevated/60
		hover:border-violet-500/40 hover:bg-bg-elevated transition-all duration-200 overflow-hidden"
>
	<!-- Department colour strip -->
	<div class="h-1.5 w-full bg-gradient-to-r {deptClasses.gradient}"></div>

	<div class="px-4 space-y-3 pb-4">
		<!-- Badges row -->
		<div class="flex flex-wrap gap-1.5 items-center justify-between">
			<div class="flex flex-wrap gap-1.5">
				<span class="px-2 py-0.5 rounded-full text-xs font-medium border {deptClasses.badge}">
					{deptLabel}
				</span>
				{#if isUnderReview}
					<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-500/15 text-violet-300 border border-violet-500/25">
						Ready for Review
					</span>
				{:else}
					<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/25">
						In Progress
					</span>
				{/if}
				{#if hasParticipated}
					<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
						You contributed
					</span>
				{/if}
			</div>
			<span class="text-xs text-white/40 tabular-nums">
				{idea.voteCount} vote{idea.voteCount !== 1 ? 's' : ''}
			</span>
		</div>

		<!-- Title + summary -->
		<div class="space-y-1.5">
			<h3 class="font-semibold text-white group-hover:text-violet-200 transition-colors line-clamp-2 leading-snug">
				{idea.title}
			</h3>
			<p class="text-sm text-white/50 line-clamp-2 leading-relaxed">
				{idea.summary}
			</p>
		</div>

		<!-- Spec progress bar -->
		<SpecProgressBar specDocument={idea.specDocument ?? null} specStatus={idea.specStatus} compact={true} />

		<!-- CTA -->
		<div class="flex justify-end">
			<span class="text-sm font-medium text-violet-400 group-hover:text-violet-300 transition-colors">
				{isUnderReview ? 'Review Spec \u2192' : 'Join Discussion \u2192'}
			</span>
		</div>
	</div>
</a>
