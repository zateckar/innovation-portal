<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button } from '$lib/components/ui';

	let { data, form } = $props();

	let runningJob = $state<string | null>(null);
</script>

<svelte:head>
	<title>Pipeline - Admin - Innovation Radar</title>
</svelte:head>

<div class="space-y-6 max-w-2xl">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Pipeline</h1>
		<p class="text-text-secondary mt-1">Trigger pipeline steps manually or run the full auto mode</p>
	</div>

	{#if form?.success}
		<div class="p-4 rounded-lg bg-success/10 border border-success/30 text-success">
			{form.message}
		</div>
	{/if}

	{#if form?.error}
		<div class="p-4 rounded-lg bg-error/10 border border-error/30 text-error">
			{form.error}
		</div>
	{/if}

	<!-- Full pipeline -->
	<Card padding="lg">
		<h2 class="text-base font-semibold text-text-primary mb-1">Full Pipeline</h2>
		<p class="text-sm text-text-muted mb-4">Run all steps in sequence automatically</p>
		<div class="space-y-3">
			<form
				method="POST"
				action="?/runAutoMode"
				use:enhance={() => {
					runningJob = 'auto';
					return async ({ update }) => { await update(); runningJob = null; };
				}}
			>
				<Button type="submit" variant="primary" class="w-full justify-start" loading={runningJob === 'auto'}>
					<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
					Run Auto Mode Pipeline
					<span class="ml-auto text-xs opacity-70">(scan → filter → research → publish)</span>
				</Button>
			</form>

			<form
				method="POST"
				action="?/runDiscover"
				use:enhance={() => {
					runningJob = 'discover';
					return async ({ update }) => { await update(); runningJob = null; };
				}}
			>
				<Button type="submit" variant="secondary" class="w-full justify-start" loading={runningJob === 'discover'}>
					<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
					</svg>
					AI Discovery Mode
					<span class="ml-auto text-xs opacity-70">(discover new innovations)</span>
				</Button>
			</form>

			{#if data.settings.jiraEnabled}
				<form
					method="POST"
					action="?/runJira"
					use:enhance={() => {
						runningJob = 'jira';
						return async ({ update }) => { await update(); runningJob = null; };
					}}
				>
					<Button type="submit" variant="secondary" class="w-full justify-start" loading={runningJob === 'jira'}>
						<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
						</svg>
						Run Jira Pipeline Now
						<span class="ml-auto text-xs opacity-70">(fetch → evaluate → realize → publish)</span>
					</Button>
				</form>
			{/if}
		</div>
	</Card>

	<!-- Individual Steps -->
	<Card padding="lg">
		<h2 class="text-base font-semibold text-text-primary mb-1">Individual Steps</h2>
		<p class="text-sm text-text-muted mb-4">Run a single step of the pipeline</p>
		<div class="space-y-2">
			<form
				method="POST"
				action="?/runScan"
				use:enhance={() => {
					runningJob = 'scan';
					return async ({ update }) => { await update(); runningJob = null; };
				}}
			>
				<Button type="submit" variant="ghost" class="w-full justify-start" loading={runningJob === 'scan'}>
					<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Run Feed Scan
					<span class="ml-auto text-xs opacity-60 text-text-muted">Step 1 — fetch from sources</span>
				</Button>
			</form>

			<form
				method="POST"
				action="?/runFilter"
				use:enhance={() => {
					runningJob = 'filter';
					return async ({ update }) => { await update(); runningJob = null; };
				}}
			>
				<Button type="submit" variant="ghost" class="w-full justify-start" loading={runningJob === 'filter'}>
					<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
					</svg>
					Run AI Filter
					<span class="ml-auto text-xs opacity-60 text-text-muted">Step 2 — score and filter</span>
				</Button>
			</form>

			<form
				method="POST"
				action="?/runResearch"
				use:enhance={() => {
					runningJob = 'research';
					return async ({ update }) => { await update(); runningJob = null; };
				}}
			>
				<Button type="submit" variant="ghost" class="w-full justify-start" loading={runningJob === 'research'}>
					<svg class="w-5 h-5 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
					</svg>
					Run AI Research
					<span class="ml-auto text-xs opacity-60 text-text-muted">Step 3 — research accepted items</span>
				</Button>
			</form>
		</div>
	</Card>

	<p class="text-xs text-text-muted">
		Configure pipeline intervals and thresholds in
		<a href="/admin/schedule" class="text-primary hover:underline">Schedule</a>.
	</p>
</div>
