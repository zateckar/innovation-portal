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
	
	function getBarGradient(val: number, maxVal: number): string {
		const ratio = val / maxVal;
		if (ratio >= 0.7) return 'linear-gradient(90deg, #18EAB0, #00E5B8)';
		if (ratio >= 0.4) return 'linear-gradient(90deg, #FAB93A, #FFC842)';
		return 'linear-gradient(90deg, #FF5C6B, #FF7A87)';
	}

	function getValueColor(val: number, maxVal: number): string {
		const ratio = val / maxVal;
		if (ratio >= 0.7) return '#18EAB0';
		if (ratio >= 0.4) return '#FAB93A';
		return '#FF5C6B';
	}

	const heights = {
		sm: '4px',
		md: '6px',
	};
</script>

<div style="display:flex; flex-direction:column; gap:4px;">
	<div style="display:flex; justify-content:space-between; align-items:center;">
		<span style="font-size:0.6875rem; color:var(--color-text-muted); font-family:var(--font-display); font-weight:600; letter-spacing:0.04em; text-transform:uppercase;">{label}</span>
		{#if showValue}
			<span style="font-size:0.6875rem; font-weight:700; font-family:var(--font-display); color:{getValueColor(value, max)}; font-variant-numeric:tabular-nums;">{value}<span style="opacity:0.5; font-weight:400;">/{max}</span></span>
		{/if}
	</div>
	<div style="
		width:100%;
		height:{heights[size]};
		background:rgba(255,255,255,0.10);
		border-radius:99px;
		overflow:hidden;
	">
		<div style="
			height:100%;
			border-radius:99px;
			width:{percentage}%;
			background:{getBarGradient(value, max)};
			transition:width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
			box-shadow: 0 0 8px rgba(0, 229, 184, 0.35);
		"></div>
	</div>
</div>
