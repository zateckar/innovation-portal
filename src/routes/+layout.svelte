<script lang="ts">
	import '../app.css';
	import { Header } from '$lib/components/layout';
	import type { Snippet } from 'svelte';
	
	interface Props {
		data: {
			user?: import('$lib/server/services/auth').SessionUser;
		};
		children: Snippet;
	}
	
	let { data, children }: Props = $props();
</script>

<svelte:head>
	<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💡</text></svg>" />
</svelte:head>

<div class="min-h-screen flex flex-col">
	<Header user={data.user} />
	
	<main class="flex-1">
		{@render children()}
	</main>
	
	<footer class="border-t border-border py-6 mt-auto">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<p class="text-center text-sm text-text-muted">
				Innovation Incubator - Discover and try the next big thing
			</p>
		</div>
	</footer>
</div>
