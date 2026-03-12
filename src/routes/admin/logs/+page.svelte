<script lang="ts">
	import { Card, Button } from '$lib/components/ui';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let refreshing = $state(false);
	let filter = $state('');

	async function refresh() {
		refreshing = true;
		await invalidateAll();
		setTimeout(() => (refreshing = false), 500);
	}

	function getLogLevel(line: string): 'info' | 'warn' | 'error' | 'debug' {
		const lower = line.toLowerCase();
		if (lower.includes('[error]')) return 'error';
		if (lower.includes('[warn]')) return 'warn';
		if (lower.includes('[debug]')) return 'debug';
		return 'info';
	}

	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function getLogClass(level: 'info' | 'warn' | 'error' | 'debug'): string {
		switch (level) {
			case 'error':
				return 'text-error bg-error/5';
			case 'warn':
				return 'text-warning bg-warning/5';
			case 'debug':
				return 'text-text-muted';
			default:
				return '';
		}
	}

	const filteredLogs = $derived(
		filter ? data.logs.filter((l) => l.toLowerCase().includes(filter.toLowerCase())) : data.logs
	);

	const currentLimit = $derived(
		typeof window !== 'undefined'
			? new URLSearchParams(window.location.search).get('limit') || '500'
			: '500'
	);
	const currentLevel = $derived(data.levelFilter || 'all');
</script>

<svelte:head>
	<title>Application Logs - Innovation Radar</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Logs</h1>
			<p class="text-text-secondary mt-1">
				Server logs with daily rotation (last 7 days kept).
				Configure log level in <a href="/admin/settings#logging" class="text-primary hover:underline">Settings → Logging</a>.
			</p>
		</div>
		<div class="flex-shrink-0 text-right">
			<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium
				{data.activeLogLevel === 'DEBUG' ? 'bg-text-muted/10 border-text-muted/30 text-text-muted'
				: data.activeLogLevel === 'INFO' ? 'bg-info/10 border-info/30 text-info'
				: data.activeLogLevel === 'WARN' ? 'bg-warning/10 border-warning/30 text-warning'
				: 'bg-error/10 border-error/30 text-error'}">
				Active level: {data.activeLogLevel}
			</span>
			<p class="text-xs text-text-muted mt-1 font-mono">{data.logFile}</p>
		</div>
	</div>

	<div class="flex flex-col md:flex-row gap-4">
		<input
			type="text"
			bind:value={filter}
			placeholder="Filter logs..."
			class="flex-1 px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
		/>

		<div class="flex gap-2 flex-wrap">
			<Button variant="secondary" onclick={refresh} loading={refreshing}>Refresh</Button>

			<!-- Level filters -->
			{#each ['all', 'error', 'warn', 'info', 'debug'] as lvl}
				<a
					href="?level={lvl}&limit={currentLimit}"
					class="px-3 py-2 rounded-lg border text-sm flex items-center transition-colors
						{currentLevel === lvl
						? 'bg-primary text-white border-primary'
						: 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover'}"
				>
					{lvl.toUpperCase()}
				</a>
			{/each}

			<!-- Line limits -->
			<div class="border-l border-border pl-2 flex gap-2">
				{#each [100, 500, 1000] as n}
					<a
						href="?limit={n}&level={currentLevel}"
						class="px-3 py-2 bg-bg-surface border border-border rounded-lg text-text-secondary hover:bg-bg-hover text-sm"
					>
						{n}
					</a>
				{/each}
			</div>
		</div>
	</div>

	{#if !data.logExists}
		<Card padding="lg">
			<div class="text-center py-8">
				<p class="text-text-secondary">
					No log file found yet.
				</p>
				<p class="text-sm text-text-muted mt-2 font-mono">{data.logFile}</p>
				<p class="text-sm text-text-muted mt-2">
					The log file is created on the first log write. If this persists after server startup,
					check write permissions or set the <code>LOG_FILE</code> env var to an absolute path.
				</p>
			</div>
		</Card>
	{:else}
		{#if data.rotatedFiles && data.rotatedFiles.length > 0}
			<div class="text-sm text-text-muted">
				Archived logs: {data.rotatedFiles.join(', ')}
			</div>
		{/if}

		<Card padding="none">
			<div class="px-4 py-2 bg-bg-hover border-b border-border flex justify-between items-center">
				<span class="text-sm text-text-secondary">
					Showing {filteredLogs.length} of {data.totalLines} lines
					{#if currentLevel !== 'all'}(filtered to {currentLevel.toUpperCase()}){/if}
				</span>
				<span class="text-sm text-text-muted font-mono">
					{data.logFile}
				</span>
			</div>

			<div class="bg-bg-primary font-mono text-sm overflow-x-auto max-h-[70vh] overflow-y-auto">
				{#each filteredLogs as line, i}
					{@const level = getLogLevel(line)}
					<div
						class="px-4 py-1 border-b border-border/50 hover:bg-bg-hover/50 {getLogClass(level)}"
					>
						<span class="text-text-muted mr-3">{data.totalLines - i}</span>
					{@html escapeHtml(line)
						.replace(
							/\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]/g,
							'<span class="text-info">[$1]</span>'
						)
						.replace(
							/\[ERROR\]/g,
							'<span class="text-error font-bold">[ERROR]</span>'
						)
						.replace(
							/\[WARN\]/g,
							'<span class="text-warning font-bold">[WARN]</span>'
						)
						.replace(
							/\[INFO\]/g,
							'<span class="text-text-secondary">[INFO]</span>'
						)
						.replace(
							/\[DEBUG\]/g,
							'<span class="text-text-muted">[DEBUG]</span>'
						)
						.replace(/(\d+\.\d+\.\d+\.\d+)/g, '<span class="text-secondary">$1</span>')
						.replace(/&quot;([^&]*)&quot;/g, '<span class="text-success">&quot;$1&quot;</span>')}
					</div>
				{:else}
					<div class="px-4 py-8 text-center text-text-secondary">
						{filter ? 'No logs match the filter' : 'No log entries found'}
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>
