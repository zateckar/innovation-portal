<script lang="ts">
	import type { Snippet } from 'svelte';
	
	interface Props {
		variant?: 'default' | 'ai' | 'oss' | 'selfhost' | 'category';
		category?: string;
		size?: 'sm' | 'md';
		children: Snippet;
	}
	
	let { 
		variant = 'default', 
		category,
		size = 'sm',
		children 
	}: Props = $props();
	
	const variants = {
		default: 'bg-bg-hover text-text-secondary border-border',
		ai: 'bg-cat-ai-ml/20 text-cat-ai-ml border-cat-ai-ml/30',
		oss: 'bg-success/20 text-success border-success/30',
		selfhost: 'bg-secondary/20 text-secondary border-secondary/30',
		category: 'bg-bg-hover text-text-secondary border-border'
	};
	
	const categoryColors: Record<string, string> = {
		'ai-ml': 'bg-cat-ai-ml/20 text-cat-ai-ml border-cat-ai-ml/30',
		'devops': 'bg-cat-devops/20 text-cat-devops border-cat-devops/30',
		'security': 'bg-cat-security/20 text-cat-security border-cat-security/30',
		'data-analytics': 'bg-cat-data/20 text-cat-data border-cat-data/30',
		'developer-tools': 'bg-cat-dev-tools/20 text-cat-dev-tools border-cat-dev-tools/30',
		'automation': 'bg-cat-automation/20 text-cat-automation border-cat-automation/30',
		'collaboration': 'bg-cat-collaboration/20 text-cat-collaboration border-cat-collaboration/30',
		'infrastructure': 'bg-cat-infrastructure/20 text-cat-infrastructure border-cat-infrastructure/30'
	};
	
	const sizes = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-3 py-1 text-sm'
	};
	
	function getVariantClass() {
		if (variant === 'category' && category && categoryColors[category]) {
			return categoryColors[category];
		}
		return variants[variant];
	}
</script>

<span 
	class="inline-flex items-center rounded-full border font-medium {getVariantClass()} {sizes[size]}"
>
	{@render children()}
</span>
