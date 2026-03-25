<script lang="ts">
	import { Card, Input, Textarea, Select, Button } from '$lib/components/ui';
	import { CATEGORY_LABELS, DEPARTMENT_LABELS } from '$lib/types';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	const item = $derived(data.catalogItem);
	
	// Track deployment type for conditional rendering (use $state + $effect for bind:group)
	let deploymentType = $state<'saas' | 'self-hosted'>('saas');
	
	$effect(() => {
		deploymentType = form?.values?.deploymentType || item.deploymentType || 'saas';
	});

	const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
	const departments = Object.entries(DEPARTMENT_LABELS).map(([value, label]) => ({ value, label }));

	const statusOptions = [
		{ value: 'active', label: 'Active - Ready to use' },
		{ value: 'maintenance', label: 'Maintenance - Temporarily unavailable' },
		{ value: 'archived', label: 'Archived - No longer maintained' }
	];
</script>

<svelte:head>
	<title>Edit {item.name} | Admin</title>
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
			<h1 class="text-2xl font-bold text-white">Edit Catalog Item</h1>
			<p class="text-zinc-400 mt-1">Update {item.name}</p>
		</div>
	</div>

	<!-- Linked Innovation Banner -->
	{#if data.linkedInnovation}
		<Card class="bg-violet-500/10 border-violet-500/30">
			<div class="p-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
					</svg>
					<div>
						<p class="text-sm text-violet-300">Linked to Innovation Radar</p>
						<p class="text-white font-medium">{data.linkedInnovation.title}</p>
					</div>
				</div>
				<a
					href="/innovations/{data.linkedInnovation.slug}"
					class="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 text-sm transition-colors"
				>
					View Research →
				</a>
			</div>
		</Card>
	{/if}

	<!-- Error message -->
	{#if form?.error}
		<div class="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
			{form.error}
		</div>
	{/if}

	<form method="POST" use:enhance class="space-y-6">
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
					value={form?.values?.department || item.department || 'general'}
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
					value={form?.values?.name || item.name}
					required
				/>
				</div>

				<div>
					<label for="description" class="block text-sm font-medium text-zinc-300 mb-1">Description *</label>
					<Textarea
						id="description"
						name="description"
						placeholder="Brief description of what this implementation does..."
						value={form?.values?.description || item.description}
						rows={3}
						required
					/>
				</div>

				<div>
					<label for="category" class="block text-sm font-medium text-zinc-300 mb-1">Category *</label>
					<Select
						id="category"
						name="category"
						value={form?.values?.category || item.category}
						required
					>
						{#each categories as cat}
							<option value={cat.value}>{cat.label}</option>
						{/each}
					</Select>
				</div>
			</div>
		</Card>

		<!-- Deployment Type -->
		<Card>
			<div class="p-4 border-b border-zinc-800">
				<h2 class="font-semibold text-white">Deployment Type</h2>
			</div>
			<div class="p-4 space-y-3">
				<div class="grid grid-cols-2 gap-3">
					<label 
						class="block p-4 rounded-lg border-2 cursor-pointer transition-all {deploymentType === 'saas' ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 hover:border-zinc-600'}"
					>
						<input 
							type="radio" 
							name="deploymentType" 
							value="saas" 
							bind:group={deploymentType}
							class="sr-only"
						/>
						<div class="flex items-center gap-3">
							<div class="w-4 h-4 rounded-full border-2 flex items-center justify-center {deploymentType === 'saas' ? 'border-emerald-500' : 'border-zinc-500'}">
								{#if deploymentType === 'saas'}
									<div class="w-2 h-2 rounded-full bg-emerald-500"></div>
								{/if}
							</div>
							<div>
								<div class="font-medium text-white text-sm">SaaS / Shared</div>
								<p class="text-xs text-zinc-500">Single URL for all users</p>
							</div>
						</div>
					</label>
					
					<label 
						class="block p-4 rounded-lg border-2 cursor-pointer transition-all {deploymentType === 'self-hosted' ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700 hover:border-zinc-600'}"
					>
						<input 
							type="radio" 
							name="deploymentType" 
							value="self-hosted" 
							bind:group={deploymentType}
							class="sr-only"
						/>
						<div class="flex items-center gap-3">
							<div class="w-4 h-4 rounded-full border-2 flex items-center justify-center {deploymentType === 'self-hosted' ? 'border-emerald-500' : 'border-zinc-500'}">
								{#if deploymentType === 'self-hosted'}
									<div class="w-2 h-2 rounded-full bg-emerald-500"></div>
								{/if}
							</div>
							<div>
								<div class="font-medium text-white text-sm">Self-Hosted</div>
								<p class="text-xs text-zinc-500">Per-user deployments</p>
							</div>
						</div>
					</label>
				</div>
				
				{#if deploymentType === 'self-hosted' && data.deploymentCount > 0}
					<div class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
						<strong>Warning:</strong> {data.deploymentCount} user(s) have active deployments for this item. 
						Changing deployment configuration may affect their instances.
					</div>
				{/if}
			</div>
		</Card>

		<!-- Implementation Details (SaaS) -->
		{#if deploymentType === 'saas'}
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
							value={form?.values?.url || (item.url !== '#self-hosted' ? item.url : '')}
							required
						/>
						<p class="text-xs text-zinc-500 mt-1">Where users can access this implementation</p>
					</div>

					<div>
						<label for="howTo" class="block text-sm font-medium text-zinc-300 mb-1">How to Use *</label>
						<Textarea
							id="howTo"
							name="howTo"
							placeholder="## Getting Started&#10;&#10;Instructions for users..."
							value={form?.values?.howTo || item.howTo}
							rows={12}
							required
						/>
						<p class="text-xs text-zinc-500 mt-1">Markdown supported. Include prerequisites, steps, and tips.</p>
					</div>
				</div>
			</Card>
		{:else}
			<!-- Self-Hosted Deployment Configuration -->
			<Card>
				<div class="p-4 border-b border-zinc-800">
					<h2 class="font-semibold text-white">Deployment API</h2>
				</div>
				<div class="p-4 space-y-4">
					<div>
						<label for="deploymentApiUrl" class="block text-sm font-medium text-zinc-300 mb-1">Deployment API URL *</label>
						<Input
							id="deploymentApiUrl"
							name="deploymentApiUrl"
							type="url"
							placeholder="https://deployment-api.example.com/deploy"
							value={form?.values?.deploymentApiUrl || item.deploymentApiUrl || ''}
							required
						/>
						<p class="text-xs text-zinc-500 mt-1">REST API endpoint that accepts K8s manifests (POST for deploy, DELETE for undeploy)</p>
					</div>

					<div>
						<label for="instanceUrlTemplate" class="block text-sm font-medium text-zinc-300 mb-1">Instance URL Template *</label>
						<Input
							id="instanceUrlTemplate"
							name="instanceUrlTemplate"
							placeholder={'https://{{username}}.apps.example.com'}
							value={form?.values?.instanceUrlTemplate || item.instanceUrlTemplate || ''}
							required
						/>
						<p class="text-xs text-zinc-500 mt-1">URL template for user instances. Use variables like {'{{username}}'}</p>
					</div>
				</div>
			</Card>

			<Card>
				<div class="p-4 border-b border-zinc-800">
					<div class="flex items-center justify-between">
						<h2 class="font-semibold text-white">K8s Deployment Manifest *</h2>
						<button 
							type="button"
							class="text-xs text-emerald-400 hover:text-emerald-300"
							onclick={() => {
								const el = document.getElementById('variablesHelp');
								if (el) el.classList.toggle('hidden');
							}}
						>
							Show Variables
						</button>
					</div>
				</div>
				<div class="p-4 space-y-4">
					<!-- Variables Help Panel -->
					<div id="variablesHelp" class="hidden p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 space-y-2">
						<p class="text-xs text-zinc-400 font-medium">Available Template Variables:</p>
						<div class="grid grid-cols-1 gap-1">
							{#each data.templateVariables as variable}
								<div class="flex items-start gap-2 text-xs">
									<code class="text-emerald-400 font-mono">{`{{${variable.name}}}`}</code>
									<span class="text-zinc-500">- {variable.description}</span>
									<span class="text-zinc-600 italic">(e.g., {variable.example})</span>
								</div>
							{/each}
						</div>
					</div>
					
					<Textarea
						id="deploymentManifest"
						name="deploymentManifest"
						placeholder={'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app-{{username}}\n...'}
						value={form?.values?.deploymentManifest || item.deploymentManifest || ''}
						rows={18}
						class="font-mono text-sm"
						required
					/>
					<p class="text-xs text-zinc-500">YAML manifest with template variables. Supports multi-document YAML (use --- separator).</p>
				</div>
			</Card>

			<Card>
				<div class="p-4 border-b border-zinc-800">
					<h2 class="font-semibold text-white">Undeploy Manifest (Optional)</h2>
				</div>
				<div class="p-4 space-y-4">
					<Textarea
						id="undeployManifest"
						name="undeployManifest"
						placeholder="# Leave empty to skip undeploy API call&#10;# Or provide cleanup manifest here..."
						value={form?.values?.undeployManifest || item.undeployManifest || ''}
						rows={8}
						class="font-mono text-sm"
					/>
					<p class="text-xs text-zinc-500">Optional manifest to send when user removes their deployment. Uses same variables as deploy manifest.</p>
				</div>
			</Card>

			<Card>
				<div class="p-4 border-b border-zinc-800">
					<h2 class="font-semibold text-white">Usage Instructions</h2>
				</div>
				<div class="p-4 space-y-4">
					<!-- Hidden input for URL since it's auto-set for self-hosted -->
					<input type="hidden" name="url" value="#self-hosted" />
					
					<div>
						<label for="howTo" class="block text-sm font-medium text-zinc-300 mb-1">How to Use *</label>
						<Textarea
							id="howTo"
							name="howTo"
							placeholder="## Getting Started&#10;&#10;This is a self-hosted deployment..."
							value={form?.values?.howTo || item.howTo}
							rows={12}
							required
						/>
						<p class="text-xs text-zinc-500 mt-1">Instructions shown to users. Explain what happens after deployment.</p>
					</div>
				</div>
			</Card>
		{/if}

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
						value={form?.values?.iconUrl || item.iconUrl || ''}
					/>
					{#if item.iconUrl}
						<div class="mt-2 flex items-center gap-2">
							<img src={item.iconUrl} alt="Current icon" class="w-8 h-8 rounded object-cover" />
							<span class="text-xs text-zinc-500">Current icon</span>
						</div>
					{/if}
				</div>

				<div>
					<label for="screenshotUrl" class="block text-sm font-medium text-zinc-300 mb-1">Screenshot URL</label>
					<Input
						id="screenshotUrl"
						name="screenshotUrl"
						type="url"
						placeholder="https://example.com/screenshot.png"
						value={form?.values?.screenshotUrl || item.screenshotUrl || ''}
					/>
					{#if item.screenshotUrl}
						<div class="mt-2">
							<img src={item.screenshotUrl} alt="Current screenshot" class="max-w-xs rounded border border-zinc-700" />
							<span class="text-xs text-zinc-500">Current screenshot</span>
						</div>
					{/if}
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
					value={form?.values?.status || item.status}
				>
					{#each statusOptions as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</Select>
				<p class="text-xs text-zinc-500 mt-2">
					<strong>Active:</strong> Ready for users to try •
					<strong>Maintenance:</strong> Temporarily unavailable •
					<strong>Archived:</strong> No longer maintained
				</p>
			</div>
		</Card>

		<!-- Metadata -->
		<Card class="bg-zinc-900/50">
			<div class="p-4 text-sm text-zinc-500 space-y-1">
				<p>Slug: <code class="text-zinc-400">{item.slug}</code></p>
				<p>Deployment Type: <span class="text-zinc-400">{item.deploymentType === 'self-hosted' ? 'Self-Hosted (per-user)' : 'SaaS (shared URL)'}</span></p>
				{#if item.deploymentType === 'self-hosted'}
					<p>Active Deployments: <span class="text-zinc-400">{data.deploymentCount}</span>
						{#if data.deploymentCount > 0}
							<a href="/api/admin/catalog/{item.id}/deployments" target="_blank" class="text-emerald-400 hover:underline ml-2">View all</a>
						{/if}
					</p>
				{/if}
				<p>Created: {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}</p>
				{#if item.updatedAt}
					<p>Last updated: {new Date(item.updatedAt).toLocaleString()}</p>
				{/if}
				{#if item.archivedAt}
					<p>Archived: {new Date(item.archivedAt).toLocaleString()}</p>
				{/if}
			</div>
		</Card>

		<!-- Submit -->
		<div class="flex justify-between">
			<a
				href="/catalog/{item.slug}"
				class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors inline-flex items-center gap-2"
				target="_blank"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
				</svg>
				Preview
			</a>
			<div class="flex gap-4">
				<a
					href="/admin/catalog"
					class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
				>
					Cancel
				</a>
				<Button type="submit" variant="primary">
					Save Changes
				</Button>
			</div>
		</div>
	</form>
</div>
