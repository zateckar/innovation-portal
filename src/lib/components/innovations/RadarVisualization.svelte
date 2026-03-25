<script lang="ts">
	import { base } from '$app/paths';
	import type { InnovationSummary } from '$lib/types';
	import { CATEGORY_COLORS, type InnovationCategory } from '$lib/types';
	
	interface Props {
		innovations: InnovationSummary[];
		compact?: boolean;
	}
	
	let { innovations, compact = false }: Props = $props();
	
	// Calculate positions for each innovation on the radar
	function getInnovationPositions() {
		const categories = [...new Set(innovations.map(i => i.category))];
		const categoryAngle = (2 * Math.PI) / Math.max(categories.length, 8);
		// In compact mode use a smaller max radius so dots stay well inside the container
		const maxRadius = compact ? 34 : 40;
		// Clamp range: leave more room in compact to avoid overflow with dot half-width
		const clampMin = compact ? 10 : 5;
		const clampMax = compact ? 90 : 95;

		return innovations.map((innovation, idx) => {
			const categoryIndex = categories.indexOf(innovation.category);
			const score = innovation.relevanceScore ?? 5;
			const normalizedDistance = 1 - (score / 10) * 0.7;
			const radius = maxRadius * normalizedDistance;
			
			const seed = hashCode(innovation.id);
			const jitterAngle = (pseudoRandom(seed) - 0.5) * (categoryAngle * 0.6);
			const jitterRadius = (pseudoRandom(seed + 1) - 0.5) * (compact ? 5 : 8);
			
			const angle = categoryAngle * categoryIndex + jitterAngle - Math.PI / 2;
			const x = 50 + (radius + jitterRadius) * Math.cos(angle);
			const y = 50 + (radius + jitterRadius) * Math.sin(angle);
			
			return {
				...innovation,
				x: Math.max(clampMin, Math.min(clampMax, x)),
				y: Math.max(clampMin, Math.min(clampMax, y)),
				size: Math.max(12, Math.min(28, 12 + innovation.voteCount * 0.5))
			};
		});
	}
	
	function hashCode(str: string): number {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash) + str.charCodeAt(i);
			hash |= 0;
		}
		return Math.abs(hash);
	}
	
	function pseudoRandom(seed: number): number {
		const x = Math.sin(seed * 9999) * 10000;
		return x - Math.floor(x);
	}
	
	const positionedInnovations = $derived(getInnovationPositions());
	
	let hoveredId = $state<string | null>(null);
</script>

<div class="relative aspect-square {compact ? 'max-w-full' : 'max-w-xl mx-auto'}">
	<!-- Radar circles -->
	<svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
		<!-- Concentric circles -->
		<circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" class="text-border" stroke-width="0.2" />
		<circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" class="text-border" stroke-width="0.2" />
		<circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" class="text-border" stroke-width="0.2" />
		
		<!-- Radial lines -->
		{#each Array(8) as _, i}
			{@const angle = (i * Math.PI * 2) / 8 - Math.PI / 2}
			<line
				x1="50"
				y1="50"
				x2={50 + 42 * Math.cos(angle)}
				y2={50 + 42 * Math.sin(angle)}
				stroke="currentColor"
				class="text-border"
				stroke-width="0.2"
			/>
		{/each}
		
		<!-- Center glow -->
		<circle cx="50" cy="50" r="4" class="fill-primary/30" />
		<circle cx="50" cy="50" r="2" class="fill-primary" />
	</svg>
	
	<!-- Innovation dots -->
	<div class="absolute inset-0">
		{#each positionedInnovations as innovation (innovation.id)}
			{@const color = CATEGORY_COLORS[innovation.category as InnovationCategory]}
		<a
			href="{base}/innovations/{innovation.slug}"
			title="{innovation.title} - {innovation.voteCount} votes"
			class="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-110 hover:z-10 flex flex-col items-center"
				style="left: {innovation.x}%; top: {innovation.y}%;"
				onmouseenter={() => hoveredId = innovation.id}
				onmouseleave={() => hoveredId = null}
			>
			<div 
				class="rounded-full transition-all duration-300"
				style="
					width: {compact ? Math.max(8, innovation.size * 0.65) : innovation.size}px; 
					height: {compact ? Math.max(8, innovation.size * 0.65) : innovation.size}px; 
					background-color: {color};
					box-shadow: 0 0 {hoveredId === innovation.id ? '14px' : '6px'} {color}80;
				"
			></div>
			{#if !compact}
				<span class="text-[10px] mt-0.5 text-text-muted max-w-[50px] truncate text-center leading-tight">{innovation.title}</span>
			{/if}
		</a>
		{/each}
	</div>
	
	<!-- Legend -->
	{#if !compact}
		<div class="absolute bottom-0 left-0 right-0 flex justify-center gap-4 text-xs text-text-muted">
			<span>Inner = High Relevance</span>
			<span>|</span>
			<span>Larger = More Votes</span>
		</div>
	{/if}
</div>
