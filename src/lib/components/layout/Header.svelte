<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import type { SessionUser } from '$lib/server/services/auth';
	
	interface Props {
		user?: SessionUser;
	}
	
	let { user }: Props = $props();
	let showUserMenu = $state(false);
	
	function toggleUserMenu() {
		showUserMenu = !showUserMenu;
	}
	
	function closeUserMenu() {
		showUserMenu = false;
	}
	
	// Helper to check current path (accounts for base path)
	function isActive(path: string): boolean {
		const currentPath = $page.url.pathname;
		const fullPath = base + path;
		if (path === '/') return currentPath === base || currentPath === base + '/';
		return currentPath.startsWith(fullPath);
	}
</script>

<svelte:window onclick={closeUserMenu} />

<header class="sticky top-0 z-50 glass border-b border-border">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">
			<!-- Logo -->
			<a href="{base}/" class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
					<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
				</div>
				<span class="text-xl font-bold gradient-text hidden sm:block">Innovation Portal</span>
			</a>
			
			<!-- Navigation -->
			<nav class="hidden md:flex items-center gap-1">
			<a 
				href="{base}/" 
				class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isActive('/') ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
			>
				Dashboard
			</a>
		<a 
			href="{base}/innovations" 
			class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isActive('/innovations') ? 'bg-teal-500/20 text-teal-400' : 'text-teal-400/70 hover:text-teal-400 hover:bg-teal-500/10'}"
		>
			<span class="flex items-center gap-1.5">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
				</svg>
				Innovations
			</span>
		</a>
				<a 
					href="{base}/catalog" 
					class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isActive('/catalog') ? 'bg-emerald-500/20 text-emerald-400' : 'text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10'}"
				>
					<span class="flex items-center gap-1.5">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
						</svg>
						Catalog
					</span>
				</a>
			<a 
				href="{base}/news" 
				class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isActive('/news') ? 'bg-blue-500/20 text-blue-400' : 'text-blue-400/70 hover:text-blue-400 hover:bg-blue-500/10'}"
			>
				<span class="flex items-center gap-1.5">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
					</svg>
					News
				</span>
			</a>
			<a 
				href="{base}/ideas" 
				class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isActive('/ideas') ? 'bg-amber-500/20 text-amber-400' : 'text-amber-400/70 hover:text-amber-400 hover:bg-amber-500/10'}"
			>
				<span class="flex items-center gap-1.5">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
					Ideas
				</span>
			</a>
		<a 
			href="{base}/propose" 
			class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isActive('/propose') ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
		>
			Propose
		</a>
		<a 
			href="{base}/about" 
			class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isActive('/about') ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
		>
			About
		</a>
				{#if user?.role === 'admin'}
					<a 
						href="{base}/admin" 
						class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isActive('/admin') ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'}"
					>
						Admin
					</a>
				{/if}
			</nav>
			
			<!-- User menu / Auth -->
			<div class="flex items-center gap-4">
				{#if user}
					<div class="relative">
						<button 
							onclick={(e) => { e.stopPropagation(); toggleUserMenu(); }}
							class="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-hover transition-colors"
						>
							<div class="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-medium text-sm">
								{user.name.charAt(0).toUpperCase()}
							</div>
							<span class="text-sm text-text-secondary hidden sm:block">{user.name}</span>
							<svg class="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>
						
						{#if showUserMenu}
							<div class="absolute right-0 mt-2 w-48 glass rounded-lg shadow-lg py-1 border border-border">
								<div class="px-4 py-2 border-b border-border">
									<p class="text-sm font-medium text-text-primary">{user.name}</p>
									<p class="text-xs text-text-muted truncate">{user.email}</p>
								</div>
							<a href="{base}/my-votes" class="block px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary">
								My Votes
							</a>
							<form method="POST" action="{base}/auth/logout">
									<button type="submit" onclick={(e) => e.stopPropagation()} class="w-full text-left px-4 py-2 text-sm text-error hover:bg-bg-hover">
										Sign out
									</button>
								</form>
							</div>
						{/if}
					</div>
			{:else}
				<a 
					href="{base}/auth/login" 
					class="px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-primary to-primary-hover text-white hover:opacity-90 transition-opacity"
				>
					Sign in
				</a>
			{/if}
			</div>
		</div>
	</div>
</header>
