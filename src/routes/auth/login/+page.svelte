<script lang="ts">
	import { enhance } from '$app/forms';
	
	let { form, data } = $props();
	let loading = $state(false);
</script>

<svelte:head>
	<title>Login - Innovation Radar</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center px-4">
	<div class="w-full max-w-md">
		<!-- Logo and title -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary mb-4">
				<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
				</svg>
			</div>
			<h1 class="text-2xl font-bold gradient-text">Innovation Radar</h1>
			<p class="text-text-secondary mt-2">Sign in to your account</p>
		</div>
		
		<!-- Login form -->
		<div class="glass rounded-2xl p-8">
			{#if form?.error || data.error}
				<div class="mb-6 p-4 rounded-lg bg-error/10 border border-error/30 text-error">
					{form?.error || data.error}
				</div>
			{/if}
			
			<!-- SSO Login Button -->
			{#if data.oidcEnabled}
				<a 
					href="/auth/oidc"
					class="w-full mb-6 py-3 px-4 rounded-lg bg-bg-surface border border-border text-text-primary font-medium hover:bg-bg-hover hover:border-border-hover transition-colors flex items-center justify-center gap-2"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
					</svg>
					Sign in with Corporate SSO
				</a>
				
				<div class="relative mb-6">
					<div class="absolute inset-0 flex items-center">
						<div class="w-full border-t border-border"></div>
					</div>
					<div class="relative flex justify-center text-sm">
						<span class="px-2 bg-bg-card text-text-muted">or continue with email</span>
					</div>
				</div>
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
				class="space-y-6"
			>
				<div>
					<label for="email" class="block text-sm font-medium text-text-secondary mb-2">
						Email address
					</label>
					<input
						type="email"
						id="email"
						name="email"
						value={form?.email ?? ''}
						required
						class="w-full px-4 py-3 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
						placeholder="you@company.com"
					/>
				</div>
				
				<div>
					<label for="password" class="block text-sm font-medium text-text-secondary mb-2">
						Password
					</label>
					<input
						type="password"
						id="password"
						name="password"
						required
						class="w-full px-4 py-3 rounded-lg bg-bg-surface border border-border text-text-primary placeholder:text-text-muted focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
						placeholder="Enter your password"
					/>
				</div>
				
				<button
					type="submit"
					disabled={loading}
					class="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-primary to-primary-hover text-white font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
				>
					{#if loading}
						<span class="inline-flex items-center">
							<svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Signing in...
						</span>
					{:else}
						Sign in
					{/if}
				</button>
			</form>
			
			<p class="mt-6 text-center text-text-secondary">
				Don't have an account?
				<a href="/auth/register" class="text-primary hover:underline">Register</a>
			</p>
		</div>
	</div>
</div>
