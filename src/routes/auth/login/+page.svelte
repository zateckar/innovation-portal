<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	
	let { form, data } = $props();
	let loading = $state(false);

	// `data.oidcEnabled` is fixed per SSR render and never changes client-side.
	const oidcEnabled = $derived(data.oidcEnabled);
	// When OIDC is configured, collapse the local login form by default.
	// untrack explicitly opts out of reactivity — the initial value is all we need.
	let showLocalLogin = $state(untrack(() => !data.oidcEnabled));
</script>

<svelte:head>
	<title>Sign In — Innovation Radar</title>
</svelte:head>

<!-- Full-screen atmospheric background -->
<div style="
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1.5rem;
	position: relative;
	overflow: hidden;
">
	<!-- Atmospheric glow orbs -->
	<div style="
		position: fixed;
		top: -20%;
		left: 50%;
		transform: translateX(-50%);
		width: 600px;
		height: 600px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(0, 212, 170, 0.08) 0%, transparent 70%);
		pointer-events: none;
	"></div>
	<div style="
		position: fixed;
		bottom: -10%;
		right: -10%;
		width: 400px;
		height: 400px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(125, 211, 252, 0.05) 0%, transparent 70%);
		pointer-events: none;
	"></div>

	<div style="width: 100%; max-width: 400px; position: relative; z-index: 1;">

		<!-- Logo + wordmark -->
		<div style="text-align: center; margin-bottom: 2.5rem;">
			<!-- Logo mark -->
			<div style="
				display: inline-flex;
				align-items: center;
				justify-content: center;
				width: 60px;
				height: 60px;
				border-radius: 16px;
				background: linear-gradient(135deg, #00D4AA 0%, #7DD3FC 100%);
				box-shadow: 0 0 40px rgba(0, 212, 170, 0.35), 0 8px 24px rgba(0,0,0,0.4);
				margin: 0 auto 1.25rem;
			">
				<svg style="width: 30px; height: 30px; color: #060810;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
				</svg>
			</div>

			<h1 style="
				font-family: var(--font-display);
				font-size: 1.75rem;
				font-weight: 800;
				letter-spacing: -0.02em;
				margin-bottom: 0.375rem;
				background: linear-gradient(135deg, #00D4AA 0%, #7DD3FC 100%);
				-webkit-background-clip: text;
				background-clip: text;
				-webkit-text-fill-color: transparent;
			">Innovation Radar</h1>
			<p style="
				font-size: 0.875rem;
				color: var(--color-text-muted);
				letter-spacing: 0.01em;
			">Sign in to your account to continue</p>
		</div>
		
		<!-- Card -->
		<div style="
			background: rgba(13, 17, 23, 0.85);
			backdrop-filter: blur(24px) saturate(1.5);
			-webkit-backdrop-filter: blur(24px) saturate(1.5);
			border: 1px solid rgba(30, 42, 58, 0.9);
			border-radius: 18px;
			padding: 2rem;
			box-shadow: 0 8px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(0, 212, 170, 0.06);
		">
			<!-- Error state -->
			{#if form?.error || data.error}
				<div style="
					margin-bottom: 1.25rem;
					padding: 0.875rem 1rem;
					border-radius: 10px;
					background: rgba(255, 71, 87, 0.08);
					border: 1px solid rgba(255, 71, 87, 0.25);
					color: #FF4757;
					font-size: 0.8125rem;
					display: flex;
					align-items: center;
					gap: 0.5rem;
				">
					<svg style="width:16px; height:16px; flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
					{form?.error || data.error}
				</div>
			{/if}

			{#if oidcEnabled}
				<!-- SSO login button — prominent -->
				<a
					href="/auth/oidc"
					style="
						display: flex;
						width: 100%;
						align-items: center;
						justify-content: center;
						gap: 0.75rem;
						padding: 0.875rem 1.25rem;
						border-radius: 12px;
						background: linear-gradient(135deg, #00D4AA 0%, #00A884 100%);
						color: #060810;
						font-family: var(--font-display);
						font-size: 0.9375rem;
						font-weight: 700;
						letter-spacing: 0.01em;
						text-decoration: none;
						box-shadow: 0 0 24px rgba(0, 212, 170, 0.3), 0 4px 12px rgba(0,0,0,0.3);
						transition: all 0.2s ease;
					"
					onmouseenter={(e) => {
						(e.currentTarget as HTMLElement).style.boxShadow = '0 0 36px rgba(0, 212, 170, 0.5), 0 6px 16px rgba(0,0,0,0.4)';
						(e.currentTarget as HTMLElement).style.opacity = '0.95';
					}}
					onmouseleave={(e) => {
						(e.currentTarget as HTMLElement).style.boxShadow = '0 0 24px rgba(0, 212, 170, 0.3), 0 4px 12px rgba(0,0,0,0.3)';
						(e.currentTarget as HTMLElement).style.opacity = '1';
					}}
				>
					<svg style="width:20px; height:20px; flex-shrink:0;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
					</svg>
					Sign in with Corporate SSO
				</a>

				<!-- Toggle for local login -->
				<div style="margin-top: 1.25rem; text-align: center;">
					<button
						type="button"
						style="
							background: none;
							border: none;
							font-size: 0.8125rem;
							color: var(--color-text-muted);
							cursor: pointer;
							display: inline-flex;
							align-items: center;
							gap: 0.375rem;
							padding: 0.25rem 0.5rem;
							border-radius: 6px;
							transition: color 0.15s ease;
						"
						onmouseenter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; }}
						onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; }}
						onclick={() => (showLocalLogin = !showLocalLogin)}
					>
						<svg
							style="width:14px; height:14px; transition:transform 0.2s ease; {showLocalLogin ? 'transform:rotate(180deg)' : ''}"
							fill="none" stroke="currentColor" viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
						</svg>
						{showLocalLogin ? 'Hide' : 'Use'} email & password
					</button>
				</div>
			{/if}

			<!-- Local login form -->
			{#if showLocalLogin}
				{#if oidcEnabled}
					<div style="margin: 1.25rem 0; height: 1px; background: linear-gradient(90deg, transparent, var(--color-border), transparent);"></div>
				{/if}

				<form 
					method="POST" 
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
						};
					}}
					style="display: flex; flex-direction: column; gap: 1.125rem;"
				>
					<!-- Email -->
					<div>
						<label for="email" style="
							display: block;
							font-family: var(--font-display);
							font-size: 0.75rem;
							font-weight: 600;
							letter-spacing: 0.06em;
							text-transform: uppercase;
							color: var(--color-text-muted);
							margin-bottom: 0.5rem;
						">
							Email Address
						</label>
						<input
							type="email"
							id="email"
							name="email"
							value={form?.email ?? ''}
							required
							placeholder="you@company.com"
							style="
								width: 100%;
								padding: 0.75rem 1rem;
								border-radius: 10px;
								background: rgba(255,255,255,0.04);
								border: 1px solid var(--color-border);
								color: var(--color-text-primary);
								font-family: var(--font-sans);
								font-size: 0.9375rem;
								outline: none;
								transition: border-color 0.2s ease, box-shadow 0.2s ease;
								box-sizing: border-box;
							"
							onfocus={(e) => {
								const el = e.target as HTMLInputElement;
								el.style.borderColor = 'rgba(0, 212, 170, 0.5)';
								el.style.boxShadow = '0 0 0 3px rgba(0, 212, 170, 0.1)';
							}}
							onblur={(e) => {
								const el = e.target as HTMLInputElement;
								el.style.borderColor = 'var(--color-border)';
								el.style.boxShadow = 'none';
							}}
						/>
					</div>
					
					<!-- Password -->
					<div>
						<label for="password" style="
							display: block;
							font-family: var(--font-display);
							font-size: 0.75rem;
							font-weight: 600;
							letter-spacing: 0.06em;
							text-transform: uppercase;
							color: var(--color-text-muted);
							margin-bottom: 0.5rem;
						">
							Password
						</label>
						<input
							type="password"
							id="password"
							name="password"
							required
							placeholder="Enter your password"
							style="
								width: 100%;
								padding: 0.75rem 1rem;
								border-radius: 10px;
								background: rgba(255,255,255,0.04);
								border: 1px solid var(--color-border);
								color: var(--color-text-primary);
								font-family: var(--font-sans);
								font-size: 0.9375rem;
								outline: none;
								transition: border-color 0.2s ease, box-shadow 0.2s ease;
								box-sizing: border-box;
							"
							onfocus={(e) => {
								const el = e.target as HTMLInputElement;
								el.style.borderColor = 'rgba(0, 212, 170, 0.5)';
								el.style.boxShadow = '0 0 0 3px rgba(0, 212, 170, 0.1)';
							}}
							onblur={(e) => {
								const el = e.target as HTMLInputElement;
								el.style.borderColor = 'var(--color-border)';
								el.style.boxShadow = 'none';
							}}
						/>
					</div>
					
					<!-- Submit -->
					<button
						type="submit"
						disabled={loading}
						style="
							width: 100%;
							padding: 0.875rem;
							border-radius: 12px;
							border: none;
							cursor: {loading ? 'not-allowed' : 'pointer'};
							opacity: {loading ? '0.6' : '1'};
							{oidcEnabled ? `
								background: rgba(255,255,255,0.06);
								border: 1px solid var(--color-border);
								color: var(--color-text-primary);
								font-family: var(--font-display);
								font-size: 0.875rem;
								font-weight: 600;
							` : `
								background: linear-gradient(135deg, #00D4AA 0%, #00A884 100%);
								color: #060810;
								font-family: var(--font-display);
								font-size: 0.9375rem;
								font-weight: 700;
								letter-spacing: 0.01em;
								box-shadow: 0 0 24px rgba(0, 212, 170, 0.25), 0 4px 12px rgba(0,0,0,0.3);
							`}
							display: flex;
							align-items: center;
							justify-content: center;
							gap: 0.5rem;
							transition: all 0.2s ease;
						"
					>
						{#if loading}
							<svg style="width:16px; height:16px; animation:spin 1s linear infinite;" fill="none" viewBox="0 0 24 24">
								<circle style="opacity:0.25;" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path style="opacity:0.75;" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Signing in...
						{:else}
							Sign in with email
						{/if}
					</button>
				</form>
			{/if}
		</div>

		<!-- Footer note -->
		<p style="
			text-align: center;
			margin-top: 1.5rem;
			font-size: 0.75rem;
			color: var(--color-text-muted);
		">
			Internal use only · Contact IT for access issues
		</p>
	</div>
</div>

<style>
@keyframes spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
</style>
