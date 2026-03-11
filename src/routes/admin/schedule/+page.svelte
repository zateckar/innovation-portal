<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card, Button } from '$lib/components/ui';
	import { DEPARTMENT_LABELS } from '$lib/types';

	let { data, form } = $props();

	const currentSettings = $derived(form?.settings ?? data.settings);

	let saving = $state(false);
	let runningJob = $state<string | null>(null);

	function formatDate(d: Date | null | undefined): string {
		if (!d) return 'Never';
		return new Date(d).toLocaleString();
	}

	function nextRun(lastRunAt: Date | null | undefined, intervalMinutes: number | null | undefined): string {
		if (!lastRunAt || !intervalMinutes) return 'Pending';
		const next = new Date(lastRunAt).getTime() + (intervalMinutes * 60 * 1000);
		const now = Date.now();
		if (next <= now) return 'Due now';
		const diff = next - now;
		const m = Math.floor(diff / 60000);
		if (m < 60) return `in ${m}m`;
		const h = Math.floor(m / 60);
		const rem = m % 60;
		return rem > 0 ? `in ${h}h ${rem}m` : `in ${h}h`;
	}

	function parseDepartments(json: string | null | undefined): string[] {
		if (!json) return [];
		try { return JSON.parse(json); } catch { return []; }
	}

	const newsDepartmentsList = $derived(parseDepartments(currentSettings.newsDepartments));
	const ideasDepartmentsList = $derived(parseDepartments(currentSettings.ideasDepartments));
</script>

<svelte:head>
	<title>Schedule - Admin - Innovation Radar</title>
</svelte:head>

<div class="space-y-6 max-w-3xl">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Schedule</h1>
		<p class="text-text-secondary mt-1">Configure when jobs run and trigger them manually</p>
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

	<form
		method="POST"
		action="?/saveSchedule"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => { await update({ reset: false }); saving = false; };
		}}
	>
		<!-- Auto Mode Pipeline -->
		<Card padding="lg" class="mb-4">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">Auto Mode Pipeline</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="autoModeEnabled" class="sr-only peer" checked={currentSettings.autoModeEnabled ?? false}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">Scan → Filter → Research → Auto-publish. When enabled, individual scan/filter/research schedules below are ignored.</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'auto'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="auto">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'auto'}>Run Now</Button>
			</form>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div>
					<label for="autoRunIntervalMinutes" class="block text-xs font-medium text-text-muted mb-1">Interval (min)</label>
					<input id="autoRunIntervalMinutes" type="number" name="autoRunIntervalMinutes" min="30" max="1440"
						value={currentSettings.autoRunIntervalMinutes ?? 60}
						class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
				</div>
				<div>
					<label for="autoPublishThreshold" class="block text-xs font-medium text-text-muted mb-1">Publish threshold (1–10)</label>
					<input id="autoPublishThreshold" type="number" name="autoPublishThreshold" min="1" max="10" step="0.5"
						value={currentSettings.autoPublishThreshold ?? 7.0}
						class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
				</div>
				<div>
					<label for="autoInnovationsPerRun" class="block text-xs font-medium text-text-muted mb-1">Innovations per run</label>
					<input id="autoInnovationsPerRun" type="number" name="autoInnovationsPerRun" min="1" max="20"
						value={currentSettings.autoInnovationsPerRun ?? 3}
						class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
				</div>
			</div>
		</Card>

		<!-- Feed Scan -->
		<Card padding="lg" class="mb-4">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">Feed Scan</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="scanEnabled" class="sr-only peer" checked={currentSettings.scanEnabled ?? true}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">Fetch new articles from RSS feeds and APIs</p>
					<p class="text-xs text-text-muted mt-1">
						Last run: {formatDate(currentSettings.scanLastRunAt)} &middot;
						Next: {nextRun(currentSettings.scanLastRunAt, currentSettings.scanIntervalMinutes)}
					</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'scan'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="scan">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'scan'}>Run Now</Button>
			</form>
			</div>
			<div>
				<label for="scanIntervalMinutes" class="block text-xs font-medium text-text-muted mb-1">Interval (min)</label>
				<input id="scanIntervalMinutes" type="number" name="scanIntervalMinutes" min="15" max="720"
					value={currentSettings.scanIntervalMinutes ?? 120}
					class="w-48 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
			</div>
		</Card>

		<!-- AI Filter -->
		<Card padding="lg" class="mb-4">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">AI Filter</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="filterEnabled" class="sr-only peer" checked={currentSettings.filterEnabled ?? true}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">Score and filter pending feed items using AI</p>
					<p class="text-xs text-text-muted mt-1">
						Last run: {formatDate(currentSettings.filterLastRunAt)} &middot;
						Next: {nextRun(currentSettings.filterLastRunAt, currentSettings.filterIntervalMinutes)}
					</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'filter'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="filter">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'filter'}>Run Now</Button>
			</form>
			</div>
			<div>
				<label for="filterIntervalMinutes" class="block text-xs font-medium text-text-muted mb-1">Interval (min)</label>
				<input id="filterIntervalMinutes" type="number" name="filterIntervalMinutes" min="15" max="360"
					value={currentSettings.filterIntervalMinutes ?? 30}
					class="w-48 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
			</div>
		</Card>

		<!-- AI Research -->
		<Card padding="lg" class="mb-4">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">AI Research</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="researchEnabled" class="sr-only peer" checked={currentSettings.researchEnabled ?? true}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">Generate detailed research reports for accepted innovations</p>
					<p class="text-xs text-text-muted mt-1">
						Last run: {formatDate(currentSettings.researchLastRunAt)} &middot;
						<span class="italic">Interval: hardcoded 60 min</span>
					</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'research'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="research">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'research'}>Run Now</Button>
			</form>
			</div>
		</Card>

		<!-- Auto-Archive -->
		<Card padding="lg" class="mb-4">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">Auto-Archive</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="archiveEnabled" class="sr-only peer" checked={currentSettings.archiveEnabled ?? false}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">Archive published innovations that have received no votes</p>
					<p class="text-xs text-text-muted mt-1">
						Last run: {formatDate(currentSettings.archiveLastRunAt)} &middot;
						<span class="italic">Interval: hardcoded 60 min</span>
					</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'archive'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="archive">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'archive'}>Run Now</Button>
			</form>
			</div>
			<div>
				<label for="archiveNoVotesDays" class="block text-xs font-medium text-text-muted mb-1">No-votes threshold (days)</label>
				<input id="archiveNoVotesDays" type="number" name="archiveNoVotesDays" min="7" max="90"
					value={currentSettings.archiveNoVotesDays ?? 14}
					class="w-48 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
			</div>
		</Card>

		<!-- Feed Cleanup -->
		<Card padding="lg" class="mb-4">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">Feed Cleanup</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="cleanupEnabled" class="sr-only peer" checked={currentSettings.cleanupEnabled ?? false}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">Remove old processed feed items from the database</p>
					<p class="text-xs text-text-muted mt-1">
						Last run: {formatDate(currentSettings.cleanupLastRunAt)} &middot;
						<span class="italic">Interval: hardcoded 60 min</span>
					</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'cleanup'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="cleanup">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'cleanup'}>Run Now</Button>
			</form>
			</div>
			<div>
				<label for="cleanupOlderThanDays" class="block text-xs font-medium text-text-muted mb-1">Keep items newer than (days)</label>
				<input id="cleanupOlderThanDays" type="number" name="cleanupOlderThanDays" min="1" max="30"
					value={currentSettings.cleanupOlderThanDays ?? 7}
					class="w-48 px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
			</div>
		</Card>

		<!-- News Generation -->
		<Card padding="lg" class="mb-4">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">News Generation</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="newsEnabled" class="sr-only peer" checked={currentSettings.newsEnabled ?? false}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">AI-curated news digests per department</p>
					<p class="text-xs text-text-muted mt-1">
						Last run: {formatDate(currentSettings.newsLastRunAt)} &middot;
						Next: {nextRun(currentSettings.newsLastRunAt, currentSettings.newsIntervalMinutes)}
					</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'news'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="news">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'news'}>Run Now</Button>
			</form>
			</div>
			<div class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="newsIntervalMinutes" class="block text-xs font-medium text-text-muted mb-1">Interval (min)</label>
						<input id="newsIntervalMinutes" type="number" name="newsIntervalMinutes" min="60" max="10080"
							value={currentSettings.newsIntervalMinutes ?? 1440}
							class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
						<span class="text-xs text-text-muted">1440 = daily</span>
					</div>
					<div>
						<label for="newsPerDepartment" class="block text-xs font-medium text-text-muted mb-1">Digests per department per run</label>
						<input id="newsPerDepartment" type="number" name="newsPerDepartment" min="1" max="5"
							value={currentSettings.newsPerDepartment ?? 1}
							class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
						<span class="text-xs text-text-muted">Default: 1 per department per run</span>
					</div>
				</div>
				<div>
					<p class="text-xs font-medium text-text-muted mb-2">Departments</p>
					<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
						{#each Object.entries(DEPARTMENT_LABELS) as [key, label]}
							<label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
								<input type="checkbox" name="newsDepartments" value={key}
									checked={newsDepartmentsList.includes(key)}
									class="w-4 h-4 rounded border-border text-primary focus:ring-primary">
								{label}
							</label>
						{/each}
					</div>
				</div>
			</div>
		</Card>

		<!-- Ideas Generation -->
		<Card padding="lg" class="mb-4">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">Ideas Generation</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="ideasEnabled" class="sr-only peer" checked={currentSettings.ideasEnabled ?? false}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">AI-generated innovation ideas, evaluated and realized with mockups</p>
					<p class="text-xs text-text-muted mt-1">
						Last run: {formatDate(currentSettings.ideasLastRunAt)} &middot;
						Next: {nextRun(currentSettings.ideasLastRunAt, currentSettings.ideasIntervalMinutes)}
					</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'ideas'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="ideas">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'ideas'}>Run Now</Button>
			</form>
			</div>
			<div class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label for="ideasIntervalMinutes" class="block text-xs font-medium text-text-muted mb-1">Interval (min)</label>
						<input id="ideasIntervalMinutes" type="number" name="ideasIntervalMinutes" min="60" max="10080"
							value={currentSettings.ideasIntervalMinutes ?? 1440}
							class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
						<span class="text-xs text-text-muted">1440 = daily</span>
					</div>
					<div>
						<label for="ideasPerBatch" class="block text-xs font-medium text-text-muted mb-1">Ideas per batch</label>
						<input id="ideasPerBatch" type="number" name="ideasPerBatch" min="1" max="20"
							value={currentSettings.ideasPerBatch ?? 5}
							class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
					</div>
					<div class="flex items-end pb-1">
						<label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
							<input type="checkbox" name="ideasAutoRealize"
								checked={currentSettings.ideasAutoRealize ?? true}
								class="w-4 h-4 rounded border-border text-primary focus:ring-primary">
							Auto-realize
						</label>
					</div>
				</div>
				<div>
					<p class="text-xs font-medium text-text-muted mb-2">Departments</p>
					<div class="grid grid-cols-2 md:grid-cols-3 gap-2">
						{#each Object.entries(DEPARTMENT_LABELS) as [key, label]}
							<label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
								<input type="checkbox" name="ideasDepartments" value={key}
									checked={ideasDepartmentsList.includes(key)}
									class="w-4 h-4 rounded border-border text-primary focus:ring-primary">
								{label}
							</label>
						{/each}
					</div>
				</div>
			</div>
		</Card>

		<!-- Jira Import -->
		<Card padding="lg" class="mb-6">
			<div class="flex items-start justify-between gap-4 mb-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-1">
						<h2 class="text-base font-semibold text-text-primary">Jira Import</h2>
						<label class="relative inline-flex items-center cursor-pointer">
							<input type="checkbox" name="jiraEnabled" class="sr-only peer" checked={currentSettings.jiraEnabled ?? false}>
							<div class="w-9 h-5 bg-bg-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
						</label>
					</div>
					<p class="text-sm text-text-muted">Import ideas from Jira via the configured JQL query</p>
					<p class="text-xs text-text-muted mt-1">
						Last run: {formatDate(currentSettings.jiraLastRunAt)} &middot;
						Next: {nextRun(currentSettings.jiraLastRunAt, currentSettings.jiraIntervalMinutes)}
					</p>
				</div>
			<form method="POST" action="?/runJob" use:enhance={() => { runningJob = 'jira'; return async ({ update }) => { await update({ reset: false }); runningJob = null; }; }}>
				<input type="hidden" name="job" value="jira">
				<Button type="submit" variant="ghost" size="sm" loading={runningJob === 'jira'}>Run Now</Button>
			</form>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label for="jiraIntervalMinutes" class="block text-xs font-medium text-text-muted mb-1">Interval (min)</label>
					<input id="jiraIntervalMinutes" type="number" name="jiraIntervalMinutes" min="60" max="10080"
						value={currentSettings.jiraIntervalMinutes ?? 1440}
						class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
					<span class="text-xs text-text-muted">1440 = daily</span>
				</div>
				<div>
					<label for="jiraMaxIssuesPerRun" class="block text-xs font-medium text-text-muted mb-1">Max issues per run</label>
					<input id="jiraMaxIssuesPerRun" type="number" name="jiraMaxIssuesPerRun" min="1" max="100"
						value={currentSettings.jiraMaxIssuesPerRun ?? 20}
						class="w-full px-3 py-1.5 bg-bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
				</div>
			</div>
			<p class="text-xs text-text-muted mt-3">
				Configure Jira credentials (URL, key, cert, JQL) in
				<a href="/admin/settings" class="text-primary hover:underline">AI & Automation</a>.
			</p>
		</Card>

		<div class="flex justify-end">
			<Button type="submit" variant="primary" loading={saving}>Save Schedule</Button>
		</div>
	</form>
</div>
