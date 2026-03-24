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
	// Background boosted from 0.12 → 0.18, borders from 0.25 → 0.38 for office readability
	const categoryStyles: Record<string, { bg: string; text: string; border: string }> = {
		'ai-ml':          { bg: 'rgba(167,139,250,0.18)', text: '#B8A0FF', border: 'rgba(184,160,255,0.40)' },
		'devops':         { bg: 'rgba(34,211,238,0.18)',  text: '#22D3EE', border: 'rgba(34,211,238,0.40)' },
		'security':       { bg: 'rgba(251,113,133,0.18)', text: '#FF7A8E', border: 'rgba(255,122,142,0.40)' },
		'data-analytics': { bg: 'rgba(251,191,36,0.18)',  text: '#FFC842', border: 'rgba(255,200,66,0.40)' },
		'developer-tools':{ bg: 'rgba(52,211,153,0.18)',  text: '#3EEAA8', border: 'rgba(62,234,168,0.40)' },
		'automation':     { bg: 'rgba(244,114,182,0.18)', text: '#F472B6', border: 'rgba(244,114,182,0.40)' },
		'collaboration':  { bg: 'rgba(129,140,248,0.18)', text: '#9BA8FF', border: 'rgba(155,168,255,0.40)' },
		'infrastructure': { bg: 'rgba(163,230,53,0.18)',  text: '#B8E84A', border: 'rgba(184,232,74,0.40)' },
	};

	function getStyle(): string {
		if (variant === 'category' && category && categoryStyles[category]) {
			const c = categoryStyles[category];
			return `background:${c.bg}; color:${c.text}; border-color:${c.border};`;
		}
		if (variant === 'ai')      return 'background:rgba(167,139,250,0.18); color:#B8A0FF; border-color:rgba(184,160,255,0.40);';
		if (variant === 'oss')     return 'background:rgba(0,229,184,0.18); color:#00E5B8; border-color:rgba(0,229,184,0.40);';
		if (variant === 'selfhost')return 'background:rgba(147,217,255,0.18); color:#93D9FF; border-color:rgba(147,217,255,0.40);';
		return 'background:rgba(255,255,255,0.08); color:var(--color-text-secondary); border-color:var(--color-border-hover);';
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
