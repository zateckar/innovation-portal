<script lang="ts">
	import { Card, Input, Textarea, Select, Button } from '$lib/components/ui';
	import { CATEGORY_LABELS, DEPARTMENT_LABELS } from '$lib/types';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
	const departments = Object.entries(DEPARTMENT_LABELS).map(([value, label]) => ({ value, label }));

	const statusOptions = [
		{ value: 'active', label: 'Active - Ready to use' },
		{ value: 'maintenance', label: 'Maintenance - Setup in progress' }
	];

	let selectedInnovation = $state('');

	$effect(() => {
		if (form?.values?.innovationId) {
			selectedInnovation = form.values.innovationId;
		}
	});
</script>

<svelte:head>
	<title>Add Catalog Item | Admin</title>
</svelte:head>

<div class="max-w-3xl mx-auto space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a href="/admin/innovations#catalog" class="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors" aria-label="Back to Innovations">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<div>
			<h1 class="text-2xl font-bold text-white">Add to Incubator Catalog</h1>
			<p class="text-zinc-400 mt-1">Create a new catalog item for users to try</p>
		</div>
	</div>

	<!-- Error message -->
	{#if form?.error}
		<div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
			{form.error}
		</div>
	{/if}

	<form method="POST" use:enhance class="space-y-6">
		<!-- Link to Innovation (optional) -->
		{#if data.availableInnovations.length > 0}
			<Card>
				<div class="p-4 border-b border-zinc-800">
					<h2 class="font-semibold text-white">Link to Innovation Radar (Optional)</h2>
					<p class="text-sm text-zinc-500 mt-1">
						Connect this catalog item to an existing innovation from the radar
					</p>
				</div>
				<div class="p-4">
					<select
						name="innovationId"
						bind:value={selectedInnovation}
						class="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white focus:outline-none focus:border-violet-500"
					>
						<option value="">-- No link (manual entry) --</option>
						{#each data.availableInnovations as innovation}
							<option value={innovation.id}>
								{innovation.title} ({innovation.voteCount} votes) - {CATEGORY_LABELS[innovation.category]}
							</option>
						{/each}
					</select>
				</div>
			</Card>
		{/if}

		<!-- Basic Info -->
		<Card>
			<div class="p-4 border-b border-zinc-800">
				<h2 class="font-semibold text-white">Basic Information</h2>
			</div>
			<div class="p-4 space-y-4">
				<div>
					<label for="department" class="block text-sm font-medium text-zinc-300 mb-1">Department</label>
					<Select
						id="department"
						name="department"
						value={form?.values?.department || 'general'}
					>
						{#each departments as dept}
							<option value={dept.value}>{dept.label}</option>
						{/each}
					</Select>
					<p class="text-xs text-zinc-500 mt-1">Which department is this tool primarily relevant for?</p>
				</div>

				<div>
					<label for="name" class="block text-sm font-medium text-zinc-300 mb-1">Name *</label>
					<Input
						id="name"
						name="name"
						placeholder="e.g., AI Code Assistant"
						value={form?.values?.name || ''}
						required
					/>
				</div>

				<div>
					<label for="description" class="block text-sm font-medium text-zinc-300 mb-1">Description *</label>
					<Textarea
						id="description"
						name="description"
						placeholder="Brief description of what this implementation does..."
						value={form?.values?.description || ''}
						rows={3}
						required
					/>
				</div>

				<div>
					<label for="category" class="block text-sm font-medium text-zinc-300 mb-1">Category *</label>
					<Select
						id="category"
						name="category"
						value={form?.values?.category || ''}
						required
					>
						<option value="">Select a category...</option>
						{#each categories as cat}
							<option value={cat.value}>{cat.label}</option>
						{/each}
					</Select>
				</div>
			</div>
		</Card>

		<!-- Implementation Details -->
		<Card>
			<div class="p-4 border-b border-zinc-800">
				<h2 class="font-semibold text-white">Implementation Details</h2>
			</div>
			<div class="p-4 space-y-4">
				<div>
					<label for="url" class="block text-sm font-medium text-zinc-300 mb-1">Access URL *</label>
					<Input
						id="url"
						name="url"
						type="url"
						placeholder="https://your-implementation.example.com"
						value={form?.values?.url || ''}
						required
					/>
					<p class="text-xs text-zinc-500 mt-1">Where users can access this implementation</p>
				</div>

				<div>
					<label for="howTo" class="block text-sm font-medium text-zinc-300 mb-1">How to Use *</label>
					<Textarea
						id="howTo"
						name="howTo"
						placeholder="## Getting Started&#10;&#10;Instructions for users...&#10;&#10;## Prerequisites&#10;&#10;- Requirement 1&#10;- Requirement 2"
						value={form?.values?.howTo || ''}
						rows={10}
						required
					/>
					<p class="text-xs text-zinc-500 mt-1">Markdown supported. Include prerequisites, steps, and tips.</p>
				</div>
			</div>
		</Card>

		<!-- Visual Assets -->
		<Card>
			<div class="p-4 border-b border-zinc-800">
				<h2 class="font-semibold text-white">Visual Assets (Optional)</h2>
			</div>
			<div class="p-4 space-y-4">
				<div>
					<label for="iconUrl" class="block text-sm font-medium text-zinc-300 mb-1">Icon URL</label>
					<Input
						id="iconUrl"
						name="iconUrl"
						type="url"
						placeholder="https://example.com/icon.png"
						value={form?.values?.iconUrl || ''}
					/>
				</div>

				<div>
					<label for="screenshotUrl" class="block text-sm font-medium text-zinc-300 mb-1">Screenshot URL</label>
					<Input
						id="screenshotUrl"
						name="screenshotUrl"
						type="url"
						placeholder="https://example.com/screenshot.png"
						value={form?.values?.screenshotUrl || ''}
					/>
				</div>
			</div>
		</Card>

		<!-- Status -->
		<Card>
			<div class="p-4 border-b border-zinc-800">
				<h2 class="font-semibold text-white">Status</h2>
			</div>
			<div class="p-4">
				<Select
					name="status"
					value={form?.values?.status || 'active'}
				>
					{#each statusOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</Select>
				<p class="text-xs text-zinc-500 mt-2">
					Set to "Maintenance" if the implementation is still being set up
				</p>
			</div>
		</Card>

		<!-- Submit -->
		<div class="flex justify-end gap-4">
			<a
				href="/admin/catalog"
				class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
			>
				Cancel
			</a>
			<Button type="submit" variant="primary">
				Add to Catalog
			</Button>
		</div>
	</form>
</div>
