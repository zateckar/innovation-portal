<script lang="ts">
	import { base } from '$app/paths';
	import { Card } from '$lib/components/ui';
	import type { IdeaSummary, IdeaStatus } from '$lib/types';
	import { DEPARTMENT_LABELS, DEPARTMENT_COLORS } from '$lib/types';

	interface Props {
		idea: IdeaSummary;
		// Kept for backwards-compatible call sites (no longer used).
		showVote?: boolean;
		voteThreshold?: number;
	}

	let { idea }: Props = $props();

	function getDepartmentGradient(department: string): string {
		const gradients: Record<string, string> = {
			'rd': 'from-purple-600/20 to-purple-900/20',
			'production': 'from-amber-600/20 to-amber-900/20',
			'hr': 'from-pink-600/20 to-pink-900/20',
			'legal': 'from-indigo-600/20 to-indigo-900/20',
			'finance': 'from-emerald-600/20 to-emerald-900/20',
			'it': 'from-cyan-600/20 to-cyan-900/20',
			'purchasing': 'from-red-600/20 to-red-900/20',
			'quality': 'from-lime-600/20 to-lime-900/20',
			'logistics': 'from-orange-600/20 to-orange-900/20',
			'general': 'from-gray-600/20 to-gray-900/20'
		};
		return gradients[department] || 'from-gray-600/20 to-gray-900/20';
	}

	function getStatusLabel(status: IdeaStatus): string {
		const labels: Record<IdeaStatus, string> = {
			'draft': 'Draft',
			'evaluated': 'Evaluated',
			'realized': 'Realized',
			'published': 'Published',
			'archived': 'Archived'
		};
		return labels[status] || status;
	}

	function getStatusColor(status: IdeaStatus): string {
		const colors: Record<IdeaStatus, string> = {
			'draft': 'bg-bg-hover text-text-muted border-border',
			'evaluated': 'bg-warning/20 text-warning border-warning/30',
			'realized': 'bg-primary/20 text-primary border-primary/30',
			'published': 'bg-success/20 text-success border-success/30',
			'archived': 'bg-bg-hover text-text-muted border-border'
		};
		return colors[status] || 'bg-bg-hover text-text-muted border-border';
	}
</script>

<Card variant="interactive" padding="none" class="group overflow-hidden">
	<a href="{base}/ideas/{idea.slug}" class="block h-full">
		<!-- Department gradient header -->
		<div class="relative h-20 bg-gradient-to-br {getDepartmentGradient(idea.department)} overflow-hidden">
			<div class="absolute inset-0 flex items-center justify-center">
				<svg class="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
				</svg>
			</div>

			<!-- Single top row: department (left) + status (right) — no overlap -->
			<div class="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
				<span
					class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs truncate max-w-[60%]"
					style="background-color: {DEPARTMENT_COLORS[idea.department]}20; color: {DEPARTMENT_COLORS[idea.department]}; border-color: {DEPARTMENT_COLORS[idea.department]}40"
				>
					{DEPARTMENT_LABELS[idea.department] || idea.department}
				</span>
				<span class="inline-flex items-center rounded-full border font-medium px-2 py-0.5 text-xs whitespace-nowrap {getStatusColor(idea.status)}">
					{getStatusLabel(idea.status)}
				</span>
			</div>
		</div>

		<!-- Content -->
		<div class="p-5">
			<!-- Title with optional rank prefix -->
			<h3 class="text-lg font-semibold text-text-primary mb-2 group-hover:text-primary transition-colors line-clamp-2">
				{#if idea.rank !== null}<span class="text-text-muted font-normal mr-1">#{idea.rank}</span>{/if}{idea.title}
			</h3>

			<!-- Summary -->
			<p class="text-sm text-text-secondary line-clamp-3">
				{idea.summary}
			</p>
		</div>
	</a>
</Card>
