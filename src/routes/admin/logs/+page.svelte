<script lang="ts">
	import { Card, Button } from '$lib/components/ui';
	import { invalidateAll } from '$app/navigation';
	
	let { data } = $props();
	
	let refreshing = $state(false);
	let filter = $state('');
	
	async function refresh() {
		refreshing = true;
		await invalidateAll();
		setTimeout(() => refreshing = false, 500);
	}
	
	function getLogLevel(line: string): 'info' | 'warn' | 'error' | 'debug' {
		const lower = line.toLowerCase();
		if (lower.includes('error') || lower.includes('err]') || lower.includes('[e]')) return 'error';
		if (lower.includes('warn') || lower.includes('[w]')) return 'warn';
		if (lower.includes('debug') || lower.includes('[d]')) return 'debug';
		return 'info';
	}
	
	function getLogClass(level: 'info' | 'warn' | 'error' | 'debug'): string {
		switch (level) {
			case 'error': return 'text-error bg-error/5';
			case 'warn': return 'text-warning bg-warning/5';
			case 'debug': return 'text-text-muted';
			default: return '';
		}
	}
	
	const filteredLogs = $derived(
		filter 
			? data.logs.filter(l => l.toLowerCase().includes(filter.toLowerCase()))
			: data.logs
	);
</script>

<svelte:head>
	<title>Application Logs - Innovation Radar</title>
</svelte:head>

<div class="space-y-4">
	<div>
		<h1 class="text-2xl font-bold text-text-primary">Logs</h1>
		<p class="text-text-secondary mt-1">View server logs and debug information</p>
	</div>
	
	<div class="flex flex-col md:flex-row gap-4">
		<input
			type="text"
			bind:value={filter}
			placeholder="Filter logs..."
			class="flex-1 px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
		>
		
		<div class="flex gap-2">
			<Button variant="secondary" onclick={refresh} loading={refreshing}>
				Refresh
			</Button>
			
			<a href="?limit=100" class="px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-secondary hover:bg-bg-hover flex items-center gap-2">
				100
			</a>
			<a href="?limit=500" class="px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-secondary hover:bg-bg-hover flex items-center gap-2">
				500
			</a>
			<a href="?limit=1000" class="px-4 py-2 bg-bg-surface border border-border rounded-lg text-text-secondary hover:bg-bg-hover flex items-center gap-2">
				1000
			</a>
		</div>
	</div>
	
	{#if !data.logExists}
		<Card padding="lg">
			<div class="text-center py-8">
				<p class="text-text-secondary">No log file found at <code>{data.logFile}</code></p>
				<p class="text-sm text-text-muted mt-2">Configure LOG_FILE environment variable to enable log viewing</p>
			</div>
		</Card>
	{:else}
		<Card padding="none">
			<div class="px-4 py-2 bg-bg-hover border-b border-border flex justify-between items-center">
				<span class="text-sm text-text-secondary">
					Showing {filteredLogs.length} of {data.totalLines} lines
				</span>
				<span class="text-sm text-text-muted font-mono">
					{data.logFile}
				</span>
			</div>
			
			<div class="bg-bg-primary font-mono text-sm overflow-x-auto max-h-[70vh] overflow-y-auto">
				{#each filteredLogs as line, i}
					{@const level = getLogLevel(line)}
					<div class="px-4 py-1 border-b border-border/50 hover:bg-bg-hover/50 {getLogClass(level)}">
						<span class="text-text-muted mr-3">{data.totalLines - i}</span>
						{@html line
							.replace(/\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]/g, '<span class="text-info">[$1]</span>')
							.replace(/\b(error|Error|ERROR)\b/g, '<span class="text-error font-bold">$1</span>')
							.replace(/\b(warn|Warn|WARN|warning|Warning|WARNING)\b/g, '<span class="text-warning font-bold">$1</span>')
							.replace(/\b(debug|Debug|DEBUG)\b/g, '<span class="text-text-muted">$1</span>')
							.replace(/(\d+\.\d+\.\d+\.\d+)/g, '<span class="text-secondary">$1</span>')
							.replace(/"([^"]+)"/g, '<span class="text-success">"$1"</span>')
						}
					</div>
				{:else}
					<div class="px-4 py-8 text-center text-text-secondary">
						No logs match the filter
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>
