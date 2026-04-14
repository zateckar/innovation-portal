<script lang="ts">
	let {
		variant = 'info',
		title = '',
		dismissible = false,
		ondismiss,
		children
	}: {
		variant?: 'success' | 'error' | 'warning' | 'info';
		title?: string;
		dismissible?: boolean;
		ondismiss?: () => void;
		children?: import('svelte').Snippet;
	} = $props();

	const styles = {
		success: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', title: 'text-green-800', text: 'text-green-700' },
		error: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-600', title: 'text-red-800', text: 'text-red-700' },
		warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-600', title: 'text-yellow-800', text: 'text-yellow-700' },
		info: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', title: 'text-blue-800', text: 'text-blue-700' }
	};

	const s = $derived(styles[variant]);

	const iconPaths = {
		success: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		error: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
		warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
		info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	};
</script>

<div class="rounded-lg border p-4 {s.bg} {s.border}" role="alert">
	<div class="flex">
		<svg class="h-5 w-5 flex-shrink-0 {s.icon}" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconPaths[variant]} />
		</svg>
		<div class="ml-3 flex-1">
			{#if title}
				<h3 class="text-sm font-semibold {s.title}">{title}</h3>
			{/if}
			{#if children}
				<div class="text-sm {s.text} {title ? 'mt-1' : ''}">
					{@render children()}
				</div>
			{/if}
		</div>
		{#if dismissible}
			<button
				type="button"
				class="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 items-center justify-center {s.text} hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-offset-2"
				onclick={ondismiss}
				aria-label="Dismiss"
			>
				<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
				</svg>
			</button>
		{/if}
	</div>
</div>
