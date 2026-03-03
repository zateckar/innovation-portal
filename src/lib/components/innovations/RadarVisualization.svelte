<script lang="ts">
	import { base } from '$app/paths';
	import type { InnovationSummary } from '$lib/types';
	import { CATEGORY_COLORS, type InnovationCategory } from '$lib/types';
	
	interface Props {
		innovations: InnovationSummary[];
	}
	
	let { innovations }: Props = $props();
	
	// Calculate positions for each innovation on the radar
	function getInnovationPositions() {
		const categories = [...new Set(innovations.map(i => i.category))];
		const categoryAngle = (2 * Math.PI) / Math.max(categories.length, 8);
		
		return innovations.map((innovation, idx) => {
			const categoryIndex = categories.indexOf(innovation.category);
			// Relevance score determines distance from center (higher = closer)
			const score = innovation.relevanceScore ?? 5;
			const normalizedDistance = 1 - (score / 10) * 0.7; // 0.3 to 1.0
			const radius = 40 * normalizedDistance; // percentage of container
			
			// Add some jitter to prevent overlap
			const jitterAngle = (Math.random() - 0.5) * (categoryAngle * 0.6);
			const jitterRadius = (Math.random() - 0.5) * 8;
			
			const angle = categoryAngle * categoryIndex + jitterAngle - Math.PI / 2;
			const x = 50 + (radius + jitterRadius) * Math.cos(angle);
			const y = 50 + (radius + jitterRadius) * Math.sin(angle);
			
			return {
				...innovation,
				x: Math.max(5, Math.min(95, x)),
				y: Math.max(5, Math.min(95, y)),
				size: Math.max(8, Math.min(20, 8 + innovation.voteCount * 0.5))
			};
		});
	}
	
	const positionedInnovations = $derived(getInnovationPositions());
	
	let hoveredId = $state<string | null>(null);
</script>

<div class="relative aspect-square max-w-2xl mx-auto">
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
			class="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 hover:scale-150 hover:z-10"
				style="left: {innovation.x}%; top: {innovation.y}%;"
				onmouseenter={() => hoveredId = innovation.id}
				onmouseleave={() => hoveredId = null}
			>
				<div 
					class="rounded-full transition-all duration-300"
					style="
						width: {innovation.size}px; 
						height: {innovation.size}px; 
						background-color: {color};
						box-shadow: 0 0 {hoveredId === innovation.id ? '20px' : '10px'} {color}80;
					"
				></div>
				
				<!-- Tooltip -->
				{#if hoveredId === innovation.id}
					<div class="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 glass rounded-lg px-3 py-2 whitespace-nowrap z-20 text-sm">
						<p class="font-medium text-text-primary">{innovation.title}</p>
						<p class="text-xs text-text-muted">{innovation.voteCount} votes</p>
					</div>
				{/if}
			</a>
		{/each}
	</div>
	
	<!-- Legend -->
	<div class="absolute bottom-0 left-0 right-0 flex justify-center gap-4 text-xs text-text-muted">
		<span>Inner = High Relevance</span>
		<span>|</span>
		<span>Larger = More Votes</span>
	</div>
</div>
