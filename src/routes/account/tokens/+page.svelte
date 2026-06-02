<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';

	interface Token {
		id: string;
		name: string;
		preview: string;
		scopes: string[];
		expiresAt: string | null;
		lastUsedAt: string | null;
		createdAt: string | null;
		revokedAt: string | null;
	}

	let { data }: { data: { tokens: Token[] } } = $props();

	// Local copy of the token list — we mutate it in place on create/revoke
	// so the user keeps the one-shot raw-token reveal visible. A page reload
	// would discard the in-memory `revealedToken`, which is the whole point
	// of the copy-to-clipboard step.
	let tokens: Token[] = $state(untrack(() => data.tokens));

	// New-token form state
	let newName = $state('');
	let newTtl = $state('365');
	let busy = $state(false);
	let formError: string | null = $state(null);

	// One-shot reveal: shown only after a successful create.
	let revealedToken: { name: string; raw: string; preview: string } | null = $state(null);
	let copied = $state(false);

	async function createToken() {
		formError = null;
		revealedToken = null;
		busy = true;
		try {
			const res = await fetch('/api/account/tokens', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					name: newName.trim(),
					ttlDays: parseInt(newTtl, 10) || undefined
				})
			});
			if (!res.ok) {
				const text = await res.text();
				formError = text || `Failed (${res.status})`;
				return;
			}
			const { token } = (await res.json()) as {
				token: { id: string; rawToken: string; preview: string; name: string; scopes: string[]; expiresAt: string; createdAt: string }
			};
			// Surface the raw token IMMEDIATELY — it is shown only once.
			revealedToken = { name: token.name, raw: token.rawToken, preview: token.preview };
			// Prepend the new row to the local list so the table reflects the
			// creation without a page reload (which would discard `revealedToken`).
			tokens = [
				{
					id: token.id,
					name: token.name,
					preview: token.preview,
					scopes: token.scopes,
					expiresAt: token.expiresAt,
					lastUsedAt: null,
					createdAt: token.createdAt,
					revokedAt: null
				},
				...tokens
			];
			newName = '';
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Failed to create token';
		} finally {
			busy = false;
		}
	}

	async function revokeToken(id: string, name: string) {
		if (!confirm(`Revoke the token "${name}"? This cannot be undone — any automation using it will start failing immediately.`)) return;
		const res = await fetch('/api/account/tokens', {
			method: 'DELETE',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ tokenId: id })
		});
		if (!res.ok) {
			formError = `Revoke failed (${res.status})`;
			return;
		}
		// Mark the row as revoked in-place so the UI reflects the action
		// without losing the (still-visible) raw-token reveal if the user
		// has not yet copied it.
		tokens = tokens.map((t) => (t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t));
	}

	async function copyRaw() {
		if (!revealedToken) return;
		try {
			await navigator.clipboard.writeText(revealedToken.raw);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard not available — user can select manually
		}
	}

	function fmtDate(s: string | null): string {
		if (!s) return '—';
		return new Date(s).toLocaleString();
	}

	function status(t: Token): { label: string; tone: 'ok' | 'warn' | 'bad' } {
		if (t.revokedAt) return { label: 'Revoked', tone: 'bad' };
		if (t.expiresAt && new Date(t.expiresAt) <= new Date()) return { label: 'Expired', tone: 'bad' };
		return { label: 'Active', tone: 'ok' };
	}
</script>

<div class="mx-auto max-w-3xl space-y-6 p-6">
	<header>
		<h1 class="font-display text-2xl font-semibold text-white">API tokens</h1>
		<p class="mt-1 text-sm text-slate-400">
			Long-lived credentials for calling the portal from external tools (CI, an AI agent,
			your terminal). Each token is shown once on creation — store it somewhere safe.
		</p>
	</header>

	<section class="rounded-lg border border-slate-800 bg-slate-900/40 p-5">
		<h2 class="font-display text-lg font-semibold text-white">Create a new token</h2>
		<form
			class="mt-4 flex flex-wrap items-end gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				createToken();
			}}
		>
			<label class="flex flex-col text-sm">
				<span class="mb-1 text-slate-300">Name</span>
				<input
					type="text"
					required
					maxlength="120"
					bind:value={newName}
					placeholder="e.g. ci-deploy"
					class="w-64 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
				/>
			</label>
			<label class="flex flex-col text-sm">
				<span class="mb-1 text-slate-300">Lifetime (days)</span>
				<input
					type="number"
					min="1"
					max="1825"
					bind:value={newTtl}
					class="w-24 rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-white focus:border-indigo-500 focus:outline-none"
				/>
			</label>
			<button
				type="submit"
				disabled={busy || !newName.trim()}
				class="rounded bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50"
			>
				{busy ? 'Creating…' : 'Create token'}
			</button>
		</form>
		{#if formError}
			<p class="mt-2 text-sm text-rose-400">{formError}</p>
		{/if}
	</section>

	{#if revealedToken}
		<section
			class="rounded-lg border-2 border-amber-500/60 bg-amber-500/5 p-5"
			aria-live="polite"
		>
			<h2 class="font-display text-lg font-semibold text-amber-300">
				Copy this token now — you won't see it again
			</h2>
			<p class="mt-1 text-sm text-amber-200/80">
				"{revealedToken.name}" was created. The portal stores only a hash from this point on.
			</p>
			<div class="mt-3 flex items-center gap-2">
				<code
					class="block w-full select-all break-all rounded bg-slate-950 px-3 py-2 font-mono text-sm text-emerald-300"
				>{revealedToken.raw}</code>
				<button
					type="button"
					onclick={copyRaw}
					class="shrink-0 rounded bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 hover:bg-amber-400"
				>
					{copied ? 'Copied!' : 'Copy'}
				</button>
			</div>
		</section>
	{/if}

	<section>
		<h2 class="font-display text-lg font-semibold text-white">Your tokens</h2>
		{#if tokens.length === 0}
			<p class="mt-3 text-sm text-slate-500">No tokens yet. Create one above.</p>
		{:else}
			<div class="mt-4 overflow-hidden rounded-lg border border-slate-800">
				<table class="w-full text-sm">
					<thead class="bg-slate-900/80 text-left text-xs uppercase text-slate-500">
						<tr>
							<th class="px-4 py-2.5">Name</th>
							<th class="px-4 py-2.5">Preview</th>
							<th class="px-4 py-2.5">Scopes</th>
							<th class="px-4 py-2.5">Last used</th>
							<th class="px-4 py-2.5">Expires</th>
							<th class="px-4 py-2.5">Status</th>
							<th class="px-4 py-2.5"></th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-800">
						{#each tokens as t (t.id)}
							{@const s = status(t)}
							<tr class="bg-slate-950/40">
								<td class="px-4 py-2.5 font-medium text-white">{t.name}</td>
								<td class="px-4 py-2.5 font-mono text-xs text-slate-400">{t.preview}…</td>
								<td class="px-4 py-2.5 text-slate-300">
									{t.scopes.length > 0 ? t.scopes.join(', ') : '—'}
								</td>
								<td class="px-4 py-2.5 text-slate-400">{fmtDate(t.lastUsedAt)}</td>
								<td class="px-4 py-2.5 text-slate-400">{fmtDate(t.expiresAt)}</td>
								<td class="px-4 py-2.5">
									<span
										class="rounded px-1.5 py-0.5 text-xs"
										class:bg-emerald-500={s.tone === 'ok'}
										class:text-slate-950={s.tone === 'ok'}
										class:bg-rose-500={s.tone === 'bad'}
										class:text-white={s.tone === 'bad'}
									>{s.label}</span>
								</td>
								<td class="px-4 py-2.5 text-right">
									{#if !t.revokedAt}
										<button
											type="button"
											onclick={() => revokeToken(t.id, t.name)}
											class="rounded border border-rose-500/40 px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
										>Revoke</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
