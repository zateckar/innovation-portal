<script lang="ts">
	import '../app.css';
	import { Header } from '$lib/components/layout';
	import type { Snippet } from 'svelte';
	
	interface Props {
		data: {
			user?: import('$lib/server/services/auth').SessionUser;
			devCount?: number;
		};
		children: Snippet;
	}
	
	let { data, children }: Props = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</svelte:head>

<div class="min-h-screen flex flex-col">
	<Header user={data.user} />
	
	<main class="flex-1">
		{@render children()}
	</main>
	
</div>
