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

	// Category color map → [bg, text, border] as rgba/hex
	const categoryStyles: Record<string, { bg: string; text: string; border: string }> = {
		'ai-ml':          { bg: 'rgba(167,139,250,0.12)', text: '#A78BFA', border: 'rgba(167,139,250,0.25)' },
		'devops':         { bg: 'rgba(34,211,238,0.12)',  text: '#22D3EE', border: 'rgba(34,211,238,0.25)' },
		'security':       { bg: 'rgba(251,113,133,0.12)', text: '#FB7185', border: 'rgba(251,113,133,0.25)' },
		'data-analytics': { bg: 'rgba(251,191,36,0.12)',  text: '#FBBF24', border: 'rgba(251,191,36,0.25)' },
		'developer-tools':{ bg: 'rgba(52,211,153,0.12)',  text: '#34D399', border: 'rgba(52,211,153,0.25)' },
		'automation':     { bg: 'rgba(244,114,182,0.12)', text: '#F472B6', border: 'rgba(244,114,182,0.25)' },
		'collaboration':  { bg: 'rgba(129,140,248,0.12)', text: '#818CF8', border: 'rgba(129,140,248,0.25)' },
		'infrastructure': { bg: 'rgba(163,230,53,0.12)',  text: '#A3E635', border: 'rgba(163,230,53,0.25)' },
	};

	function getStyle(): string {
		if (variant === 'category' && category && categoryStyles[category]) {
			const c = categoryStyles[category];
			return `background:${c.bg}; color:${c.text}; border-color:${c.border};`;
		}
		if (variant === 'ai')      return 'background:rgba(167,139,250,0.12); color:#A78BFA; border-color:rgba(167,139,250,0.25);';
		if (variant === 'oss')     return 'background:rgba(16,217,160,0.12); color:#10D9A0; border-color:rgba(16,217,160,0.25);';
		if (variant === 'selfhost')return 'background:rgba(125,211,252,0.12); color:#7DD3FC; border-color:rgba(125,211,252,0.25);';
		return 'background:rgba(255,255,255,0.05); color:var(--color-text-secondary); border-color:var(--color-border);';
	}

	const sizeStyles = {
		sm: 'font-size:0.6875rem; padding:0.125rem 0.5rem; letter-spacing:0.04em;',
		md: 'font-size:0.75rem; padding:0.25rem 0.625rem; letter-spacing:0.03em;',
	};
</script>

<span 
	style="
		display: inline-flex;
		align-items: center;
		border-radius: 4px;
		border-width: 1px;
		border-style: solid;
		font-family: var(--font-display);
		font-weight: 600;
		text-transform: uppercase;
		{sizeStyles[size]}
		{getStyle()}
	"
>
	{@render children()}
</span>
