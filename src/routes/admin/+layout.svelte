<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	let { children } = $props();

	function isActive(path: string, exact = false): boolean {
		const current = $page.url.pathname;
		const full = base + path;
		if (exact || path === '/admin') return current === full || current === full + '/';
		return current.startsWith(full);
	}

	const navGroups = [
		{
			label: 'Content',
			items: [
				{
					href: '/admin/innovations',
					label: 'Innovations',
					// also highlight when editing catalog items or on old /admin/pending
					alsoMatch: ['/admin/catalog', '/admin/pending'],
					icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />`
				},
				{
					href: '/admin/news',
					label: 'News',
					icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />`
				},
			{
				href: '/admin/ideas',
				label: 'Ideas',
				icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />`
			},
			{
				href: '/admin/trends',
				label: 'Trends',
				icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />`
			}
			]
		},
		{
			label: 'Pipeline',
			items: [
				{
					href: '/admin/schedule',
					label: 'Schedule & Run',
					icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />`
				}
			]
		},
		{
			label: 'System',
			items: [
				{
					href: '/admin/sources',
					label: 'Sources',
					icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />`
				},
				{
					href: '/admin/settings',
					label: 'AI & Automation',
					icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />`
				},
				{
					href: '/admin/users',
					label: 'Users',
					icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />`
				},
				{
					href: '/admin/logs',
					label: 'Logs',
					icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />`
				}
			]
		}
	];
</script>

<div class="flex min-h-[calc(100vh-4rem)]">
	<!-- Sidebar -->
	<aside class="w-56 shrink-0 border-r border-border bg-bg-surface">
		<nav class="sticky top-16 p-4 space-y-6">
			<!-- Dashboard link -->
			<a
				href="{base}/admin"
				class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors
					{isActive('/admin')
						? 'bg-primary/15 text-primary'
						: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
			>
				<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
				</svg>
				Dashboard
			</a>

			<!-- Groups -->
			{#each navGroups as group}
				<div>
					<p class="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
						{group.label}
					</p>
					<div class="space-y-0.5">
						{#each group.items as item}
							{@const active = isActive(item.href) || (item.alsoMatch ?? []).some(p => isActive(p))}
							<a
								href="{base}{item.href}"
								class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors
									{active
										? 'bg-primary/15 text-primary'
										: 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
							>
								<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									{@html item.icon}
								</svg>
								{item.label}
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</nav>
	</aside>

	<!-- Main content -->
	<main class="flex-1 min-w-0 p-6 lg:p-8">
		{@render children()}
	</main>
</div>
