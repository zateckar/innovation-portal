import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: '0.0.0.0'
	},
	ssr: {
		// bun:sqlite is a Bun built-in — Node.js (used by Vite's build workers)
		// cannot resolve the bun: URL scheme. Mark these as external so Vite
		// leaves the imports untouched for Bun to resolve at runtime.
		external: ['bun:sqlite', 'drizzle-orm/bun-sqlite']
	}
});
