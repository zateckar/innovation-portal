# Tech Reference — READ BEFORE WRITING ANY CODE

## Authentication — CRITICAL

**DO NOT implement any auth system.** The user is ALWAYS authenticated by the main
Innovation Incubator app before any request reaches this app. Auth is handled entirely
by the proxy — you will never see an unauthenticated request.

### Reading the current user

`hooks.server.ts` (already in the scaffold) populates `event.locals.user` from
trusted proxy headers. Use it in every load function and action:

```typescript
// +page.server.ts or +layout.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const { user } = locals;
  // user.id, user.email, user.name, user.role, user.department
  return { user };
};
```

**NEVER create:**
- `/auth/login`, `/auth/logout`, `/auth/callback` routes
- Any session cookie logic
- Any password or token handling

---

## Base Path — CRITICAL

This app is served at `/apps/{uuid}/v{version}/`. All links and redirects MUST
include the base path prefix, which is available at runtime via `$app/paths`.

### Links in Svelte components

```svelte
<script lang="ts">
  import { base } from '$app/paths';
</script>

<!-- CORRECT -->
<a href="{base}/items">Items</a>
<a href="{base}/items/{id}">Item detail</a>

<!-- WRONG — will 404 because there's no route at /items -->
<a href="/items">Items</a>
```

### Redirects in server code

```typescript
import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';

// CORRECT
throw redirect(302, `${base}/items`);

// WRONG
throw redirect(302, '/items');
```

---

## Database Init — CRITICAL

There are no migrations. Tables must be created in `src/lib/server/db/index.ts`
using `CREATE TABLE IF NOT EXISTS` so they exist on first startup.

```typescript
// src/lib/server/db/index.ts — add after creating the sqlite connection:
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES items(id),
    label TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
```

The DDL must exactly mirror the Drizzle schema columns and types.

---

## Svelte 5 Runes Syntax (NOT Svelte 4)

```svelte
<script lang="ts">
  // Reactive state (replaces `let x = writable(0)`)
  let count = $state(0);

  // Derived values (replaces `$: doubled = count * 2`)
  let doubled = $derived(count * 2);

  // Side effects (replaces `$: { ... }`)
  $effect(() => {
    console.log('count changed:', count);
  });

  // Props (replaces `export let name`)
  let { name, items = [] }: { name: string; items?: string[] } = $props();
</script>

<!-- Event handlers: use onclick not on:click -->
<button onclick={() => count++}>Count: {count}</button>

<!-- Snippets (replaces slots) -->
{#snippet header()}
  <h1>Header</h1>
{/snippet}
```

### WRONG patterns — do NOT use these:
- `import { writable } from 'svelte/store'` — Use `$state()` instead
- `export let prop` — Use `let { prop } = $props()` instead
- `$: reactive = ...` — Use `$derived(...)` or `$effect(...)` instead
- `on:click={handler}` — Use `onclick={handler}` instead
- `<slot />` — Use `{#snippet}` and `{@render}` instead
- `createEventDispatcher()` — Pass callback props instead

---

## TailwindCSS v4

```css
/* src/app.css — this is ALL you need */
@import "tailwindcss";

/* Custom theme overrides (optional): */
@theme {
  --color-primary: #00E5B8;
  --color-secondary: #93D9FF;
}
```

Do NOT use `@tailwind base; @tailwind components; @tailwind utilities;` — that is v3 syntax.

---

## Dark Mode — Class-Based Toggle

The scaffold's `DarkModeToggle` component adds/removes `.dark` on `<html>`. Tailwind v4 defaults
to media-query dark mode, so you **must** opt into class-based dark mode in `app.css`:

```css
/* src/app.css — already present in scaffold */
@import 'tailwindcss';

/* REQUIRED: enables dark: utilities when .dark is on <html> */
@variant dark (&:where(.dark, .dark *));
```

Then use `dark:` utility classes on any element that should change in dark mode:

```svelte
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <p class="text-gray-600 dark:text-gray-300">Content</p>
</div>
```

The scaffold's `app.css` also includes CSS overrides for common Tailwind utilities
(`bg-white`, `bg-gray-50`, `text-gray-900`, etc.) so that components using those classes
automatically adapt without adding `dark:` to every element.

---

## Drizzle ORM + SQLite

> **IMPORTANT:** This project runs under **Bun**, not Node.js. Always use `bun:sqlite` and
> `drizzle-orm/bun-sqlite`. Never use `better-sqlite3` or `drizzle-orm/better-sqlite3` — those
> are Node.js native addons and will crash under Bun on Windows.

```typescript
// Schema definition (src/lib/server/db/schema.ts)
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  done: integer('done', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Usage in server code
import { db } from '$lib/server/db';
import { items } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// Select all
const allItems = db.select().from(items).all();

// Insert
db.insert(items).values({ id: crypto.randomUUID(), name: 'New item' }).run();

// Update
db.update(items).set({ done: true }).where(eq(items.id, 'abc')).run();

// Delete
db.delete(items).where(eq(items.id, 'abc')).run();
```

---

## SvelteKit Routing

```
src/routes/
  +page.svelte          → /
  +page.server.ts       → load() and form actions for /
  +layout.svelte        → layout wrapping all pages
  +layout.server.ts     → load user from locals, pass to pages
  items/
    +page.svelte        → /items
    +page.server.ts     → load/actions for /items
    [id]/
      +page.svelte      → /items/:id
      +page.server.ts   → load/actions for /items/:id
  api/
    items/
      +server.ts        → GET/POST /api/items
      [id]/
        +server.ts      → GET/PUT/DELETE /api/items/:id
```

---

## Root Layout — Always Pass User

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return { user: locals.user };
};
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { base } from '$app/paths';
  let { data, children } = $props();
</script>

<nav>
  <a href="{base}/">Home</a>
  <span>{data.user.name} ({data.user.role})</span>
</nav>

{@render children()}
```

---

## SvelteKit Load Functions & Form Actions

```typescript
// +page.server.ts
import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
  const { user } = locals;
  const items = db.select().from(schema.items).all();
  return { items, user };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const { user } = locals;
    const formData = await request.formData();
    const name = formData.get('name') as string;
    if (!name?.trim()) return fail(400, { error: 'Name is required' });
    db.insert(schema.items).values({ id: crypto.randomUUID(), name }).run();
    return { success: true };
  },
  delete: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    db.delete(schema.items).where(eq(schema.items.id, id)).run();
    throw redirect(302, `${base}/items`);
  }
};
```

---

## Using Form Actions in Svelte Components

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { base } from '$app/paths';

  let { data } = $props();
</script>

<form method="POST" action="?/create" use:enhance>
  <input name="name" type="text" required />
  <button type="submit">Add</button>
</form>

{#each data.items as item}
  <p><a href="{base}/items/{item.id}">{item.name}</a></p>
{/each}
```

---

## Input Validation with Zod — CRITICAL

Use Zod for ALL input validation. Never use ad-hoc `if (!name)` checks.

```typescript
// src/lib/server/validation.ts — define schemas here
import { z } from 'zod';

export const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  priority: z.enum(['low', 'medium', 'high'], { message: 'Invalid priority' }),
  description: z.string().max(2000).optional(),
});

export const updateItemSchema = createItemSchema.partial();
```

### CRITICAL — Optional enum/select fields and empty strings

HTML `<select>` elements with a "None" option send `value=""` when unselected. Zod's
`z.enum([...]).optional()` accepts `undefined` but **rejects** `""`, causing a 400 error.

**Always wrap optional enum/select fields with `z.preprocess`:**

```typescript
// WRONG — rejects empty string from <select name="priority"><option value="">None</option>
priority: z.enum(['low', 'medium', 'high']).optional(),

// CORRECT — coerces "" and null to undefined before Zod sees it
priority: z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.enum(['low', 'medium', 'high']).optional()
),
```

Apply this to **every** optional `z.enum`, `z.string().optional()` from a select, or any field
whose HTML form element can emit an empty string.

```typescript
```

```typescript
// In form actions — use safeParse for user-friendly errors
import { createItemSchema } from '$lib/server/validation';

export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    const raw = Object.fromEntries(formData);
    const result = createItemSchema.safeParse(raw);

    if (!result.success) {
      return fail(400, {
        errors: result.error.flatten().fieldErrors,
        values: raw  // return values so form re-populates
      });
    }

    db.insert(schema.items).values({ id: crypto.randomUUID(), ...result.data }).run();
    return { success: true };
  }
};
```

```svelte
<!-- Show inline validation errors in forms -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import { FormField } from '$lib/components/ui';
  let { data, form } = $props();
</script>

<form method="POST" action="?/create" use:enhance>
  <FormField
    label="Name"
    name="name"
    required
    value={form?.values?.name ?? ''}
    error={form?.errors?.name?.[0] ?? ''}
  />
  <Button type="submit">Create</Button>
</form>

{#if form?.success}
  <Alert variant="success" title="Created successfully" dismissible />
{/if}
```

---

## Pre-Built UI Components — USE THESE

The scaffold includes a component library at `$lib/components/ui/`. **Always use these
components instead of writing raw HTML.** This ensures visual consistency.

### Available components

| Component | Import | Purpose |
|-----------|--------|---------|
| `Button` | `$lib/components/ui` | Primary, secondary, danger, ghost buttons with loading state |
| `Card` | `$lib/components/ui` | Container with optional header/footer |
| `Table` | `$lib/components/ui` | Data table with empty state built in |
| `Modal` | `$lib/components/ui` | Confirmation/detail dialogs |
| `FormField` | `$lib/components/ui` | Label + input + error message + help text |
| `Alert` | `$lib/components/ui` | Success, error, warning, info messages |
| `Badge` | `$lib/components/ui` | Status pills (success, warning, danger) |
| `EmptyState` | `$lib/components/ui` | "No items yet" with CTA button |
| `PageHeader` | `$lib/components/ui` | Page title + description + action buttons |
| `Spinner` | `$lib/components/ui` | Loading indicator |
| `Pagination` | `$lib/components/ui` | Page navigation for lists |

### Usage examples

```svelte
<script lang="ts">
  import { Button, Card, Table, PageHeader, Alert, Badge, EmptyState, Modal } from '$lib/components/ui';
  import { base } from '$app/paths';
  import { enhance } from '$app/forms';

  let { data, form } = $props();
  let deleteId = $state<string | null>(null);
</script>

<svelte:head><title>Items - My App</title></svelte:head>

<PageHeader title="Items" description="Manage your items">
  {#snippet actions()}
    <Button onclick={() => { /* open form */ }}>Add Item</Button>
  {/snippet}
</PageHeader>

{#if form?.success}
  <Alert variant="success" title="Done!" dismissible class="mb-4">
    Item saved successfully.
  </Alert>
{/if}

<Card>
  <Table
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status' },
    ]}
    rows={data.items}
    emptyTitle="No items yet"
    emptyMessage="Create your first item to get started."
  />
</Card>

<!-- Delete confirmation modal -->
<Modal
  open={!!deleteId}
  title="Delete item?"
  confirmLabel="Delete"
  variant="danger"
  onconfirm={() => { /* submit delete form */ }}
  oncancel={() => (deleteId = null)}
>
  <p class="text-sm text-gray-600">This action cannot be undone.</p>
</Modal>
```

---

## UI Quality Standards — CRITICAL

### Responsive Design
Every page MUST work at all screen sizes. Use Tailwind responsive prefixes:
- **Mobile** (default): single column, stacked layout, full-width elements
- **Tablet** (`md:`): two-column grids where appropriate
- **Desktop** (`lg:`): max-width containers, optional sidebar

```svelte
<!-- Responsive grid example -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {#each items as item}
    <Card title={item.name}>...</Card>
  {/each}
</div>
```

### Empty States
Every list or table MUST handle the empty case with a helpful message and action:

```svelte
{#if data.items.length === 0}
  <EmptyState
    title="No items yet"
    message="Create your first item to get started."
    action={{ label: 'Add Item', href: `${base}/items/new` }}
  />
{:else}
  <!-- render items -->
{/if}
```

### Loading & Submission Feedback
Every form MUST use `use:enhance` with feedback:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  let submitting = $state(false);
</script>

<form method="POST" action="?/create" use:enhance={() => {
  submitting = true;
  return async ({ update }) => {
    submitting = false;
    await update();
  };
}}>
  <Button type="submit" loading={submitting}>Save</Button>
</form>
```

### Error Display
Form validation errors MUST appear inline next to the field, not just as a banner:

```svelte
<FormField label="Title" name="title" required
  error={form?.errors?.title?.[0] ?? ''} />
```

### Destructive Actions
- Delete buttons MUST use `variant="danger"` (red styling)
- Delete actions MUST show a confirmation Modal before executing
- The confirmation modal MUST explain what will happen

### Page Titles
Every page MUST set a title:

```svelte
<svelte:head>
  <title>Page Name - App Name</title>
</svelte:head>
```

### Navigation Active State
The root `+layout.svelte` (already in scaffold) highlights the current page.
When adding new routes, add them to the `navItems` array in `+layout.svelte`:

```typescript
const navItems = [
  { href: `${base}/`, label: 'Home' },
  { href: `${base}/items`, label: 'Items' },
  { href: `${base}/reports`, label: 'Reports' },
];
```

### Accessibility
- Every `<input>` MUST have a `<label>` (use FormField component)
- Every `<img>` MUST have an `alt` attribute
- Every icon-only button MUST have an `aria-label`
- Use semantic HTML: `<main>`, `<nav>`, `<section>`, `<article>`, `<header>`
- Interactive elements must have visible focus styles (already in app.css)

### Success Feedback
After create/update/delete, show a success Alert:

```svelte
{#if form?.success}
  <Alert variant="success" dismissible ondismiss={() => { /* clear */ }}>
    Item created successfully.
  </Alert>
{/if}
```

---

## Vitest Testing

```typescript
// src/lib/server/example.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

describe('feature', () => {
  beforeEach(() => { /* setup */ });

  it('should do X when given Y', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

---

## File Structure Convention
- Server code: `src/lib/server/` (never imported from client)
- Shared types: `src/lib/types.ts`
- Validation schemas: `src/lib/server/validation.ts`
- Components: `src/lib/components/`
- Pre-built UI: `src/lib/components/ui/` (DO NOT MODIFY — use as-is)
- DB schema: `src/lib/server/db/schema.ts`
- DB connection + table init: `src/lib/server/db/index.ts`
- Tests: co-located, `*.test.ts` next to the file they test
- Identity hook: `src/hooks.server.ts` (DO NOT MODIFY)
- Error page: `src/routes/+error.svelte` (already in scaffold)
- Root layout: `src/routes/+layout.svelte` (update navItems, DO NOT remove structure)
- Root layout server: `src/routes/+layout.server.ts` (DO NOT MODIFY)
