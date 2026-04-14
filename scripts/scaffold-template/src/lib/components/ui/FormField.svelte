<script lang="ts">
	let {
		label,
		name,
		type = 'text',
		value = '',
		placeholder = '',
		error = '',
		helpText = '',
		required = false,
		disabled = false,
		rows = 3,
		options = [],
		class: className = ''
	}: {
		label: string;
		name: string;
		type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'tel' | 'date' | 'textarea' | 'select';
		value?: string | number;
		placeholder?: string;
		error?: string;
		helpText?: string;
		required?: boolean;
		disabled?: boolean;
		rows?: number;
		options?: { value: string; label: string }[];
		class?: string;
	} = $props();

	const inputClasses = $derived(
		`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 ${
			error
				? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
				: 'border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-blue-500'
		} ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'}`
	);
</script>

<div class="{className}">
	<label for={name} class="block text-sm font-medium text-gray-700 mb-1">
		{label}
		{#if required}
			<span class="text-red-500" aria-hidden="true">*</span>
		{/if}
	</label>

	{#if type === 'textarea'}
		<textarea
			id={name}
			{name}
			{rows}
			{placeholder}
			{required}
			{disabled}
			class={inputClasses}
			aria-invalid={!!error}
			aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
		>{value}</textarea>
	{:else if type === 'select'}
		<select
			id={name}
			{name}
			{required}
			{disabled}
			class={inputClasses}
			aria-invalid={!!error}
			aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
		>
			{#if placeholder}
				<option value="" disabled selected>{placeholder}</option>
			{/if}
			{#each options as opt}
				<option value={opt.value} selected={String(value) === opt.value}>{opt.label}</option>
			{/each}
		</select>
	{:else}
		<input
			id={name}
			{name}
			{type}
			value={String(value)}
			{placeholder}
			{required}
			{disabled}
			class={inputClasses}
			aria-invalid={!!error}
			aria-describedby={error ? `${name}-error` : helpText ? `${name}-help` : undefined}
		/>
	{/if}

	{#if error}
		<p id="{name}-error" class="mt-1 text-sm text-red-600" role="alert">{error}</p>
	{:else if helpText}
		<p id="{name}-help" class="mt-1 text-sm text-gray-500">{helpText}</p>
	{/if}
</div>
