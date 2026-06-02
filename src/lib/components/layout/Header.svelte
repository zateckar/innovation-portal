<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import type { SessionUser } from '$lib/server/services/auth';

	interface Props {
		user?: SessionUser;
	}

	let { user }: Props = $props();

	// Which dropdown is currently open (by key). null = none.
	let openMenu = $state<string | null>(null);
	let showUserMenu = $state(false);

	function closeAll() {
		openMenu = null;
		showUserMenu = false;
	}

	type NavChild = { label: string; href: string; desc: string; icon: string; accent: string; badge?: boolean };
	type NavGroup = { key: string; label: string; href: string; accent: string; children: NavChild[] };

	const groups: NavGroup[] = [
		{
			key: 'inspiration',
			label: 'Get Inspiration',
			href: '/inspiration',
			accent: '#00E5B8',
			children: [
				{ label: 'News', href: '/news', desc: 'Latest industry digests', accent: '#93D9FF', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
				{ label: 'Trends', href: '/trends', desc: 'Strategic foresight', accent: '#FF7D55', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
				{ label: 'Software on the Market', href: '/innovations', desc: 'Discovered tools & solutions', accent: '#00E5B8', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
				{ label: 'Catalog', href: '/catalog', desc: 'Ready-to-use incubator tools', accent: '#3EEAA8', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
				{ label: 'Ideas', href: '/ideas', desc: 'Generated proposals to vote on', accent: '#FFC842', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' }
			]
		},
		{
			key: 'build',
			label: 'Build your Ideas',
			href: '/build',
			accent: '#B8A0FF',
			children: [
				{ label: 'Propose an Idea', href: '/propose', desc: 'Submit your own idea', accent: '#FFC842', icon: 'M12 4v16m8-8H4' },
				{ label: 'My Ideas', href: '/ideas?source=user', desc: 'User-proposed ideas to vote on', accent: '#FFC842', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
				{ label: 'Development', href: '/development', desc: 'Build pipeline & progress', accent: '#B8A0FF', badge: true, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
			]
		}
	];

	// Active-state helpers (ignore query string)
	function pathMatches(href: string): boolean {
		const path = href.split('?')[0];
		const current = $page.url.pathname;
		const full = base + path;
		if (path === '/') return current === base || current === base + '/';
		return current === full || current.startsWith(full + '/');
	}

	function groupActive(group: NavGroup): boolean {
		return pathMatches(group.href) || group.children.some((c) => pathMatches(c.href));
	}

	const devCount = $derived(($page.data.devCount as number | undefined) ?? 0);
</script>

<svelte:window onclick={closeAll} />

<header
	class="sticky top-0 z-50 border-b border-white/10"
	style="background: rgba(20, 29, 44, 0.78); backdrop-filter: blur(20px) saturate(1.4); -webkit-backdrop-filter: blur(20px) saturate(1.4); box-shadow: 0 1px 0 rgba(255,255,255,0.04), 0 2px 16px rgba(8,12,20,0.18);"
>
	<div class="max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">

			<!-- Logo -->
			<a href="{base}/" class="flex items-center gap-3 group shrink-0" style="text-decoration: none;">
				<div
					class="relative w-9 h-9 flex items-center justify-center shrink-0"
					style="background: linear-gradient(135deg, #00E5B8 0%, #93D9FF 100%); border-radius: 10px; box-shadow: 0 0 16px rgba(0,229,184,0.30);"
				>
					<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
				</div>
				<div class="hidden sm:flex flex-col leading-none">
					<span class="gradient-text" style="font-family: var(--font-display); font-size: 1rem; font-weight: 700; letter-spacing: -0.01em;">Innovation</span>
					<span style="font-family: var(--font-display); font-size: 0.65rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--color-text-muted);">Portal</span>
				</div>
			</a>

			<!-- Primary navigation -->
			<nav class="hidden md:flex items-center gap-1">
				<!-- Dashboard -->
				<a
					href="{base}/"
					class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors {pathMatches('/') ? 'text-text-primary bg-white/8' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}"
					style="text-decoration: none;"
				>
					Dashboard
				</a>

				<!-- Dropdown groups -->
				{#each groups as group (group.key)}
					{@const active = groupActive(group)}
				<div
					class="relative"
					role="presentation"
					onmouseenter={() => (openMenu = group.key)}
					onmouseleave={() => (openMenu = null)}
				>
						<a
							href="{base}{group.href}"
							onclick={(e) => e.stopPropagation()}
							class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors {active ? 'text-text-primary bg-white/8' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}"
							style="text-decoration: none; {active ? `box-shadow: inset 0 -2px 0 ${group.accent};` : ''}"
						>
							{group.label}
							<svg class="w-3.5 h-3.5 transition-transform {openMenu === group.key ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</a>

					{#if openMenu === group.key}
						<div class="absolute left-0 top-full pt-2">
						<div
							class="glass-light w-72 rounded-xl overflow-hidden p-1.5 animate-fade-in"
							style="z-index: 60;"
						>
								{#each group.children as child (child.href)}
									{@const childActive = pathMatches(child.href)}
									<a
										href="{base}{child.href}"
										onclick={(e) => { e.stopPropagation(); openMenu = null; }}
										class="flex items-start gap-3 px-2.5 py-2 rounded-lg transition-colors {childActive ? 'bg-white/8' : 'hover:bg-white/6'}"
										style="text-decoration: none;"
									>
										<span
											class="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5"
											style="background: {child.accent}1a; border: 1px solid {child.accent}33;"
										>
											<svg class="w-4 h-4" style="color: {child.accent};" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={child.icon} />
											</svg>
										</span>
										<span class="min-w-0 flex-1">
											<span class="flex items-center gap-2">
												<span class="text-sm font-semibold text-text-primary truncate">{child.label}</span>
												{#if child.badge && devCount > 0}
													<span class="inline-flex items-center justify-center min-w-4 h-4 px-1 text-[0.625rem] font-bold rounded-full text-white" style="background: #7C3AED; line-height: 1;">{devCount > 9 ? '9+' : devCount}</span>
												{/if}
											</span>
											<span class="block text-xs text-text-muted leading-snug mt-0.5">{child.desc}</span>
										</span>
									</a>
								{/each}
							</div>
						</div>
						{/if}
					</div>
				{/each}
			</nav>

			<!-- Right side: utility + user -->
			<div class="flex items-center gap-2">
				<!-- More dropdown (About / Presentation / Admin) -->
				<div
					class="relative hidden md:block"
					role="presentation"
					onmouseenter={() => (openMenu = 'more')}
					onmouseleave={() => (openMenu = null)}
				>
					<button
						type="button"
						onclick={(e) => { e.stopPropagation(); openMenu = openMenu === 'more' ? null : 'more'; }}
						class="flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
						aria-label="More"
					>
						<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
					</button>

				{#if openMenu === 'more'}
					<div class="absolute right-0 top-full pt-2">
					<div class="glass-light w-44 rounded-xl overflow-hidden p-1.5 animate-fade-in" style="z-index: 60;">
							<a href="{base}/about" onclick={(e) => { e.stopPropagation(); openMenu = null; }} class="block px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-white/6 transition-colors" style="text-decoration:none;">About</a>
							{#if user}
								<a href="/tv-presentation.html" target="_blank" onclick={(e) => { e.stopPropagation(); openMenu = null; }} class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/6" style="text-decoration:none; color:#f472b6;">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
									Presentation
								</a>
							{/if}
							{#if user?.role === 'admin'}
								<a href="{base}/admin" onclick={(e) => { e.stopPropagation(); openMenu = null; }} class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/6" style="text-decoration:none; color:#FF8060;">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
								Admin
							</a>
						{/if}
					</div>
					</div>
					{/if}
				</div>

				{#if user}
					<div class="relative">
						<button
							onclick={(e) => { e.stopPropagation(); showUserMenu = !showUserMenu; openMenu = null; }}
							class="flex items-center gap-2 py-1 pl-1 pr-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 transition-colors"
						>
							<div class="flex items-center justify-center w-7 h-7 rounded-md shrink-0" style="background: linear-gradient(135deg, #00E5B8, #93D9FF); font-family: var(--font-display); font-size: 0.8125rem; font-weight: 700; color: #060810;">
								{user.name.charAt(0).toUpperCase()}
							</div>
							<span class="hidden sm:block text-sm text-text-secondary max-w-28 truncate">{user.name}</span>
							<svg class="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
						</button>

						{#if showUserMenu}
							<div class="glass-light absolute right-0 mt-2 w-52 rounded-xl overflow-hidden animate-fade-in" style="z-index: 60;">
								<div class="px-4 py-3 border-b border-white/10">
									<p class="text-sm font-semibold text-text-primary truncate" style="font-family: var(--font-display);">{user.name}</p>
									<p class="text-xs text-text-muted truncate">{user.email}</p>
								</div>
								<div class="p-1.5">
									<a href="{base}/my-votes" onclick={(e) => e.stopPropagation()} class="block px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-white/6 transition-colors" style="text-decoration:none;">My Votes</a>
									<a href="{base}/about" onclick={(e) => e.stopPropagation()} class="block md:hidden px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-white/6 transition-colors" style="text-decoration:none;">About</a>
									{#if user.role === 'admin'}
										<a href="{base}/admin" onclick={(e) => e.stopPropagation()} class="block md:hidden px-3 py-2 rounded-lg text-sm hover:bg-white/6 transition-colors" style="text-decoration:none; color:#FF8060;">Admin</a>
									{/if}
									<form method="POST" action="{base}/auth/logout">
										<button type="submit" onclick={(e) => e.stopPropagation()} class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-error/10" style="color: var(--color-error); background: transparent; border: none; cursor: pointer;">Sign out</button>
									</form>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<a
						href="{base}/auth/login"
						class="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold"
						style="font-family: var(--font-display); letter-spacing: 0.02em; background: linear-gradient(135deg, #00E5B8 0%, #00BF98 100%); color: #060810; text-decoration: none; box-shadow: 0 0 14px rgba(0,229,184,0.28);"
					>
						Sign in
					</a>
				{/if}
			</div>
		</div>
	</div>
</header>
