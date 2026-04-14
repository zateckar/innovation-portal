<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/stores';
	import '../app.css';

	let { data, children } = $props();

	let mobileMenuOpen = $state(false);

	// Navigation items — the AI builder will populate this from the plan
	const navItems: { href: string; label: string }[] = [
		{ href: `${base}/`, label: 'Home' }
	];

	function isActive(href: string): boolean {
		if (href === `${base}/`) return $page.url.pathname === `${base}/` || $page.url.pathname === `${base}`;
		return $page.url.pathname.startsWith(href);
	}
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Top navigation bar -->
	<nav class="bg-white border-b border-gray-200 shadow-sm">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-14">
				<!-- Left: nav links -->
				<div class="flex items-center">
					<!-- Mobile menu button -->
					<button
						type="button"
						class="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
						onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
						aria-expanded={mobileMenuOpen}
						aria-label="Toggle navigation menu"
					>
						<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							{#if mobileMenuOpen}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							{:else}
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
							{/if}
						</svg>
					</button>

					<!-- Desktop nav links -->
					<div class="hidden sm:flex sm:items-center sm:gap-1 sm:ml-2">
						{#each navItems as item}
							<a
								href={item.href}
								class="px-3 py-2 text-sm font-medium rounded-lg transition-colors {isActive(item.href)
									? 'bg-blue-50 text-blue-700'
									: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}"
								aria-current={isActive(item.href) ? 'page' : undefined}
							>
								{item.label}
							</a>
						{/each}
					</div>
				</div>

				<!-- Right: user info -->
				<div class="flex items-center gap-3">
					<span class="text-sm text-gray-500 hidden sm:inline">{data.user.name}</span>
					<div class="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium text-blue-700" aria-label="{data.user.name}">
						{data.user.name?.charAt(0)?.toUpperCase() || '?'}
					</div>
				</div>
			</div>
		</div>

		<!-- Mobile nav menu -->
		{#if mobileMenuOpen}
			<div class="sm:hidden border-t border-gray-200 py-2 px-4">
				{#each navItems as item}
					<a
						href={item.href}
						class="block px-3 py-2 text-sm font-medium rounded-lg {isActive(item.href)
							? 'bg-blue-50 text-blue-700'
							: 'text-gray-600 hover:bg-gray-100'}"
						onclick={() => (mobileMenuOpen = false)}
					>
						{item.label}
					</a>
				{/each}
				<div class="mt-2 pt-2 border-t border-gray-200 px-3 py-2 text-sm text-gray-500">
					{data.user.name} ({data.user.role})
				</div>
			</div>
		{/if}
	</nav>

	<!-- Main content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
		{@render children()}
	</main>
</div>
