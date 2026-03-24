<script lang="ts">
	import { base } from '$app/paths';
	import { Badge, ScoreBar } from '$lib/components/ui';
	import type { InnovationSummary } from '$lib/types';
	import { CATEGORY_LABELS } from '$lib/types';
	import VoteButton from './VoteButton.svelte';
	
	interface Props {
		innovation: InnovationSummary;
		showVote?: boolean;
	}
	
	let { innovation, showVote = true }: Props = $props();

	// Map category → vivid color for hero accent
	const categoryAccents: Record<string, { primary: string; secondary: string; glow: string }> = {
		'ai-ml':          { primary: '#A78BFA', secondary: '#7C3AED', glow: 'rgba(167,139,250,0.15)' },
		'devops':         { primary: '#22D3EE', secondary: '#0891B2', glow: 'rgba(34,211,238,0.15)' },
		'security':       { primary: '#FB7185', secondary: '#BE123C', glow: 'rgba(251,113,133,0.15)' },
		'data-analytics': { primary: '#FBBF24', secondary: '#D97706', glow: 'rgba(251,191,36,0.15)' },
		'developer-tools':{ primary: '#34D399', secondary: '#059669', glow: 'rgba(52,211,153,0.15)' },
		'automation':     { primary: '#F472B6', secondary: '#BE185D', glow: 'rgba(244,114,182,0.15)' },
		'collaboration':  { primary: '#818CF8', secondary: '#4338CA', glow: 'rgba(129,140,248,0.15)' },
		'infrastructure': { primary: '#A3E635', secondary: '#65A30D', glow: 'rgba(163,230,53,0.15)' },
	};

	function getAccent(cat: string) {
		return categoryAccents[cat] ?? { primary: '#8B9EB7', secondary: '#4A5A6E', glow: 'rgba(139,158,183,0.1)' };
	}

	const accent = $derived(getAccent(innovation.category));
</script>

<a 
	href="{base}/innovations/{innovation.slug}" 
	class="group block"
	style="text-decoration: none;"
>
	<div
	role="presentation"
	style="
		background: rgba(23, 32, 48, 0.88);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		overflow: hidden;
		box-shadow: 0 2px 16px rgba(0,0,0,0.22);
		transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
		height: 100%;
		display: flex;
		flex-direction: column;
	"
	onmouseenter={(e) => {
		const el = e.currentTarget as HTMLElement;
		el.style.borderColor = accent.primary + '60';
		el.style.boxShadow = `0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px ${accent.primary}30, 0 0 30px ${accent.glow}`;
		el.style.transform = 'translateY(-2px)';
	}}
	onmouseleave={(e) => {
		const el = e.currentTarget as HTMLElement;
		el.style.borderColor = 'var(--color-border)';
		el.style.boxShadow = '0 2px 16px rgba(0,0,0,0.22)';
		el.style.transform = 'translateY(0)';
	}}
	>
		<!-- Hero band with abstract pattern -->
		<div style="
			position: relative;
			height: 7rem;
			background: linear-gradient(135deg, {accent.secondary}38 0%, {accent.primary}20 60%, transparent 100%), linear-gradient(180deg, #131E2E 0%, #0F1623 100%);
			border-bottom: 1px solid {accent.primary}20;
			overflow: hidden;
			flex-shrink: 0;
		">
			{#if innovation.heroImageUrl}
				<img 
					src={innovation.heroImageUrl} 
					alt={innovation.title}
					style="width:100%; height:100%; object-fit:cover; opacity:0.6; transition:opacity 0.25s ease;"
					class="group-hover:opacity-80"
				/>
				<!-- Gradient overlay on image -->
				<div style="position:absolute; inset:0; background:linear-gradient(to top, rgba(23,32,48,0.85) 0%, transparent 60%);"></div>
			{:else}
				<!-- Abstract geometric decoration -->
				<div style="position:absolute; inset:0; overflow:hidden;">
					<!-- Large circle -->
					<div style="
						position: absolute;
						width: 120px;
						height: 120px;
						border-radius: 50%;
						border: 1px solid {accent.primary}20;
						top: -40px;
						right: -30px;
					"></div>
					<div style="
						position: absolute;
						width: 60px;
						height: 60px;
						border-radius: 50%;
						border: 1px solid {accent.primary}15;
						top: 10px;
						right: 20px;
					"></div>
					<!-- Icon -->
					<div style="
						position: absolute;
						top: 50%;
						left: 50%;
						transform: translate(-50%, -50%);
						width: 40px;
						height: 40px;
						border-radius: 10px;
						background: {accent.primary}18;
						border: 1px solid {accent.primary}30;
						display: flex;
						align-items: center;
						justify-content: center;
					">
						<svg style="width:20px; height:20px; color:{accent.primary}; opacity:0.7;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
						</svg>
					</div>
				</div>
			{/if}

			<!-- Category badge -->
			<div style="position:absolute; top:10px; left:10px; z-index:1;">
				<Badge variant="category" category={innovation.category}>
					{CATEGORY_LABELS[innovation.category]}
				</Badge>
			</div>

			<!-- Accent line at bottom of hero -->
			<div style="
				position: absolute;
				bottom: 0;
				left: 0;
				right: 0;
				height: 2px;
				background: linear-gradient(90deg, {accent.primary}60, transparent);
			"></div>
		</div>
		
		<!-- Content -->
		<div style="padding: 1rem 1.125rem; flex:1; display:flex; flex-direction:column;">
			<!-- Feature badges -->
			<div style="display:flex; flex-wrap:wrap; gap:0.375rem; margin-bottom:0.625rem;">
				{#if innovation.hasAiComponent}
					<Badge variant="ai">AI</Badge>
				{/if}
				{#if innovation.isOpenSource}
					<Badge variant="oss">OSS</Badge>
				{/if}
				{#if innovation.isSelfHosted}
					<Badge variant="selfhost">Self-Host</Badge>
				{/if}
				{#if innovation.maturityLevel}
					<Badge>
						{innovation.maturityLevel.charAt(0).toUpperCase() + innovation.maturityLevel.slice(1)}
					</Badge>
				{/if}
			</div>
			
			<!-- Title -->
			<h3 style="
				font-family: var(--font-display);
				font-size: 1rem;
				font-weight: 700;
				color: var(--color-text-primary);
				margin-bottom: 0.375rem;
				display: -webkit-box;
				-webkit-line-clamp: 1;
				-webkit-box-orient: vertical;
				overflow: hidden;
				letter-spacing: -0.01em;
				transition: color 0.15s ease;
			" class="group-hover:!text-[{accent.primary}]">
				{innovation.title}
			</h3>
			
			<!-- Tagline -->
			<p style="
				font-size: 0.8125rem;
				color: var(--color-text-secondary);
				display: -webkit-box;
				-webkit-line-clamp: 2;
				-webkit-box-orient: vertical;
				overflow: hidden;
				line-height: 1.5;
				margin-bottom: 0.875rem;
				flex:1;
			">
				{innovation.tagline}
			</p>
			
			<!-- Scores -->
			<div style="display:grid; grid-template-columns:1fr 1fr; gap:0.625rem; margin-bottom:{showVote ? '0.875rem' : '0'};">
				{#if innovation.relevanceScore !== null}
					<ScoreBar label="Relevance" value={innovation.relevanceScore} />
				{/if}
				{#if innovation.actionabilityScore !== null}
					<ScoreBar label="Action" value={innovation.actionabilityScore} />
				{/if}
			</div>
		</div>

		<!-- Vote section -->
		{#if showVote}
			<div style="
				padding: 0.75rem 1.125rem;
				border-top: 1px solid var(--color-border);
				display: flex;
				align-items: center;
				justify-content: space-between;
			">
				<VoteButton 
					innovationId={innovation.id} 
					voteCount={innovation.voteCount} 
					hasVoted={innovation.hasVoted}
				/>
				<span style="
					font-size: 0.75rem;
					color: var(--color-text-muted);
					font-family: var(--font-display);
					font-weight: 600;
					letter-spacing: 0.04em;
					text-transform: uppercase;
					transition: color 0.15s ease;
				" class="group-hover:!text-[{accent.primary}]">
					Details →
				</span>
			</div>
		{/if}
	</div>
</a>
