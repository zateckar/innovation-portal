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

<header class="sticky top-0 z-50" style="
	background: rgba(15, 22, 35, 0.92);
	backdrop-filter: blur(20px) saturate(1.6);
	-webkit-backdrop-filter: blur(20px) saturate(1.6);
	border-bottom: 1px solid rgba(46, 69, 96, 0.9);
	box-shadow: 0 1px 0 rgba(0, 229, 184, 0.10), 0 4px 24px rgba(0,0,0,0.25);
">
	<div class="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-10">
		<div class="flex items-center justify-between h-16">

			<!-- Logo -->
			<a href="{base}/" class="flex items-center gap-3 group" style="text-decoration: none;">
				<!-- Geometric logo mark -->
				<div class="relative w-9 h-9 flex-shrink-0" style="
					background: linear-gradient(135deg, #00E5B8 0%, #93D9FF 100%);
					border-radius: 10px;
					box-shadow: 0 0 20px rgba(0, 229, 184, 0.4);
					display: flex;
					align-items: center;
					justify-content: center;
				">
					<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
					</svg>
				</div>
				<div class="hidden sm:flex flex-col leading-none">
					<span style="
						font-family: var(--font-display);
						font-size: 1rem;
						font-weight: 700;
						letter-spacing: -0.01em;
					background: linear-gradient(135deg, #00E5B8 0%, #93D9FF 100%);
					-webkit-background-clip: text;
					background-clip: text;
					-webkit-text-fill-color: transparent;
					">Innovation</span>
					<span style="
						font-family: var(--font-display);
						font-size: 0.65rem;
						font-weight: 600;
						letter-spacing: 0.12em;
						text-transform: uppercase;
						color: var(--color-text-muted);
					">Portal</span>
				</div>
			</a>

			<!-- Navigation -->
			<nav class="hidden md:flex items-center">
				<!-- Dashboard -->
				<a 
					href="{base}/" 
					class="nav-link {isActive('/') ? 'nav-link--active' : ''}"
					style="
						display: flex;
						align-items: center;
						padding: 0.375rem 0.875rem;
						border-radius: 6px;
						font-family: var(--font-sans);
						font-size: 0.8125rem;
						font-weight: 500;
						transition: all 0.15s ease;
						color: {isActive('/') ? 'var(--color-text-primary)' : 'var(--color-text-muted)'};
						background: {isActive('/') ? 'rgba(255,255,255,0.06)' : 'transparent'};
						text-decoration: none;
					"
				>
					Dashboard
				</a>

				<!-- Innovations -->
				<a 
					href="{base}/innovations" 
					style="
						display: flex;
						align-items: center;
						gap: 0.375rem;
						padding: 0.375rem 0.875rem;
						border-radius: 6px;
						font-family: var(--font-sans);
						font-size: 0.8125rem;
						font-weight: 500;
						transition: all 0.15s ease;
					color: {isActive('/innovations') ? '#00E5B8' : 'rgba(0, 229, 184, 0.75)'};
					background: {isActive('/innovations') ? 'rgba(0, 229, 184, 0.10)' : 'transparent'};
						text-decoration: none;
					"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
					Innovations
				</a>

				<!-- Catalog -->
				<a 
					href="{base}/catalog" 
					style="
						display: flex;
						align-items: center;
						gap: 0.375rem;
						padding: 0.375rem 0.875rem;
						border-radius: 6px;
						font-family: var(--font-sans);
						font-size: 0.8125rem;
						font-weight: 500;
						transition: all 0.15s ease;
					color: {isActive('/catalog') ? '#3EEAA8' : 'rgba(62, 234, 168, 0.75)'};
					background: {isActive('/catalog') ? 'rgba(62, 234, 168, 0.10)' : 'transparent'};
						text-decoration: none;
					"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
					</svg>
					Catalog
				</a>

				<!-- News -->
				<a 
					href="{base}/news" 
					style="
						display: flex;
						align-items: center;
						gap: 0.375rem;
						padding: 0.375rem 0.875rem;
						border-radius: 6px;
						font-family: var(--font-sans);
						font-size: 0.8125rem;
						font-weight: 500;
						transition: all 0.15s ease;
					color: {isActive('/news') ? '#93D9FF' : 'rgba(147, 217, 255, 0.75)'};
					background: {isActive('/news') ? 'rgba(147, 217, 255, 0.10)' : 'transparent'};
						text-decoration: none;
					"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
					</svg>
					News
				</a>

				<!-- Ideas -->
				<a 
					href="{base}/ideas" 
					style="
						display: flex;
						align-items: center;
						gap: 0.375rem;
						padding: 0.375rem 0.875rem;
						border-radius: 6px;
						font-family: var(--font-sans);
						font-size: 0.8125rem;
						font-weight: 500;
						transition: all 0.15s ease;
					color: {isActive('/ideas') ? '#FFC842' : 'rgba(255, 200, 66, 0.80)'};
					background: {isActive('/ideas') ? 'rgba(255, 200, 66, 0.10)' : 'transparent'};
						text-decoration: none;
					"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
					Ideas
				</a>

				<!-- Development -->
				<a 
					href="{base}/development" 
					style="
						display: flex;
						align-items: center;
						gap: 0.375rem;
						padding: 0.375rem 0.875rem;
						border-radius: 6px;
						font-family: var(--font-sans);
						font-size: 0.8125rem;
						font-weight: 500;
						transition: all 0.15s ease;
					color: {isActive('/development') ? '#B8A0FF' : 'rgba(184, 160, 255, 0.78)'};
					background: {isActive('/development') ? 'rgba(184, 160, 255, 0.10)' : 'transparent'};
						text-decoration: none;
					"
				>
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					Development
					{#if ($page.data.devCount ?? 0) > 0}
						<span style="
							display: inline-flex;
							align-items: center;
							justify-content: center;
							min-width: 1rem;
							height: 1rem;
							padding: 0 0.25rem;
							font-size: 0.625rem;
							font-weight: 700;
							border-radius: 9999px;
							background: #7C3AED;
							color: white;
							line-height: 1;
						">
							{($page.data.devCount ?? 0) > 9 ? '9+' : $page.data.devCount}
						</span>
					{/if}
				</a>

				<!-- Propose -->
				<a 
					href="{base}/propose" 
					style="
						display: flex;
						align-items: center;
						padding: 0.375rem 0.875rem;
						border-radius: 6px;
						font-family: var(--font-sans);
						font-size: 0.8125rem;
						font-weight: 500;
						transition: all 0.15s ease;
						color: {isActive('/propose') ? 'var(--color-text-primary)' : 'var(--color-text-muted)'};
						background: {isActive('/propose') ? 'rgba(255,255,255,0.06)' : 'transparent'};
						text-decoration: none;
					"
				>
					Propose
				</a>

				<!-- Separator -->
				<div style="width: 1px; height: 18px; background: var(--color-border); margin: 0 0.5rem;"></div>

				<!-- About -->
				<a 
					href="{base}/about" 
					style="
						display: flex;
						align-items: center;
						padding: 0.375rem 0.75rem;
						border-radius: 6px;
						font-family: var(--font-sans);
						font-size: 0.8125rem;
						font-weight: 500;
						transition: all 0.15s ease;
						color: {isActive('/about') ? 'var(--color-text-primary)' : 'var(--color-text-muted)'};
						background: {isActive('/about') ? 'rgba(255,255,255,0.06)' : 'transparent'};
						text-decoration: none;
					"
				>
					About
				</a>

				{#if user?.role === 'admin'}
					<a 
						href="{base}/admin" 
						style="
							display: flex;
							align-items: center;
							gap: 0.375rem;
							padding: 0.25rem 0.625rem;
							border-radius: 5px;
							font-family: var(--font-display);
							font-size: 0.7rem;
							font-weight: 700;
							letter-spacing: 0.06em;
							text-transform: uppercase;
							transition: all 0.15s ease;
					color: {isActive('/admin') ? '#FF8060' : 'rgba(255, 128, 96, 0.80)'};
					background: {isActive('/admin') ? 'rgba(255, 128, 96, 0.12)' : 'transparent'};
					border: 1px solid {isActive('/admin') ? 'rgba(255, 128, 96, 0.35)' : 'rgba(255, 128, 96, 0.22)'};
							text-decoration: none;
						"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						Admin
					</a>
				{/if}
			</nav>

			<!-- User menu / Auth -->
			<div class="flex items-center gap-3">
				{#if user}
					<div class="relative">
						<button 
							onclick={(e) => { e.stopPropagation(); toggleUserMenu(); }}
							style="
								display: flex;
								align-items: center;
								gap: 0.5rem;
								padding: 0.25rem 0.5rem 0.25rem 0.25rem;
								border-radius: 8px;
								background: rgba(255,255,255,0.04);
								border: 1px solid var(--color-border);
								cursor: pointer;
								transition: all 0.15s ease;
							"
						>
							<div style="
								width: 30px;
								height: 30px;
								border-radius: 6px;
								background: linear-gradient(135deg, #00E5B8, #93D9FF);
								display: flex;
								align-items: center;
								justify-content: center;
								font-family: var(--font-display);
								font-size: 0.8125rem;
								font-weight: 700;
								color: #060810;
								flex-shrink: 0;
							">
								{user.name.charAt(0).toUpperCase()}
							</div>
							<span style="font-size: 0.8125rem; color: var(--color-text-secondary); display: none;" class="sm:!block">{user.name}</span>
							<svg class="w-3.5 h-3.5" style="color: var(--color-text-muted); flex-shrink: 0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>
						
						{#if showUserMenu}
							<div style="
								position: absolute;
								right: 0;
								margin-top: 0.5rem;
								width: 12rem;
								background: rgba(20, 30, 46, 0.97);
								backdrop-filter: blur(20px);
								border: 1px solid var(--color-border);
								border-radius: 10px;
								box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(0, 229, 184, 0.12);
								overflow: hidden;
								z-index: 100;
							">
								<div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border);">
									<p style="font-family: var(--font-display); font-size: 0.875rem; font-weight: 600; color: var(--color-text-primary);">{user.name}</p>
									<p style="font-size: 0.75rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{user.email}</p>
								</div>
								<a href="{base}/my-votes" style="
									display: block;
									padding: 0.625rem 1rem;
									font-size: 0.8125rem;
									color: var(--color-text-secondary);
									text-decoration: none;
									transition: all 0.15s ease;
								" onmouseenter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.target as HTMLElement).style.color = 'var(--color-text-primary)'; }} onmouseleave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; (e.target as HTMLElement).style.color = 'var(--color-text-secondary)'; }}>
									My Votes
								</a>
								<form method="POST" action="{base}/auth/logout">
									<button type="submit" onclick={(e) => e.stopPropagation()} style="
										width: 100%;
										text-align: left;
										padding: 0.625rem 1rem;
										font-size: 0.8125rem;
										color: var(--color-error);
										background: transparent;
										border: none;
										cursor: pointer;
										transition: all 0.15s ease;
									" onmouseenter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255, 71, 87, 0.06)'; }} onmouseleave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}>
										Sign out
									</button>
								</form>
							</div>
						{/if}
					</div>
				{:else}
					<a 
						href="{base}/auth/login" 
						style="
							display: inline-flex;
							align-items: center;
							padding: 0.4375rem 1rem;
							border-radius: 7px;
							font-family: var(--font-display);
							font-size: 0.8125rem;
							font-weight: 600;
							letter-spacing: 0.02em;
						background: linear-gradient(135deg, #00E5B8 0%, #00BF98 100%);
						color: #060810;
						text-decoration: none;
						box-shadow: 0 0 18px rgba(0, 229, 184, 0.35);
							transition: all 0.2s ease;
						"
					onmouseenter={(e) => { (e.target as HTMLElement).style.boxShadow = '0 0 28px rgba(0, 229, 184, 0.55)'; (e.target as HTMLElement).style.opacity = '0.92'; }}
					onmouseleave={(e) => { (e.target as HTMLElement).style.boxShadow = '0 0 18px rgba(0, 229, 184, 0.35)'; (e.target as HTMLElement).style.opacity = '1'; }}
					>
						Sign in
					</a>
				{/if}
			</div>
		</div>
	</div>
</header>
