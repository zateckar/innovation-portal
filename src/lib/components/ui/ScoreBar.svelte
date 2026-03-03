<script lang="ts">
	interface Props {
		label: string;
		value: number;
		max?: number;
		showValue?: boolean;
		size?: 'sm' | 'md';
	}
	
	let { 
		label, 
		value, 
		max = 10, 
		showValue = true,
		size = 'sm'
	}: Props = $props();
	
	const percentage = $derived(Math.min(100, Math.max(0, (value / max) * 100)));
	
	function getBarColor(val: number, maxVal: number) {
		const ratio = val / maxVal;
		if (ratio >= 0.7) return 'bg-success';
		if (ratio >= 0.4) return 'bg-warning';
		return 'bg-error';
	}
	
	const heights = {
		sm: 'h-1.5',
		md: 'h-2'
	};
</script>

<div class="space-y-1">
	<div class="flex justify-between items-center text-xs">
		<span class="text-text-muted">{label}</span>
		{#if showValue}
			<span class="text-text-secondary font-medium">{value}/{max}</span>
		{/if}
	</div>
	<div class="w-full bg-bg-hover rounded-full {heights[size]} overflow-hidden">
		<div 
			class="{heights[size]} rounded-full transition-all duration-500 {getBarColor(value, max)}"
			style="width: {percentage}%"
		></div>
	</div>
</div>
