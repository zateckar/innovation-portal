import adapter from '@sveltejs/adapter-node';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

function normalizeBasePath(path) {
	if (!path) return '';
	path = String(path).trim().replace(/\/+$/, '');
	if (!path) return '';
	if (!path.startsWith('/')) path = '/' + path;
	return path;
}

// Resolve base path from (in order): BASE_PATH env var, then a `.basepath`
// file in the workspace root. The file-based fallback is critical: env vars
// don't reliably propagate through long-lived agent server processes that
// orchestrate AI-driven builds, but a file persisted in the workspace
// always wins.
function resolveBasePath() {
	const fromEnv = normalizeBasePath(process.env.BASE_PATH);
	if (fromEnv) return fromEnv;

	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const basepathFile = resolve(here, '.basepath');
		if (existsSync(basepathFile)) {
			return normalizeBasePath(readFileSync(basepathFile, 'utf-8'));
		}
	} catch {
		// fall through to empty
	}

	return '';
}

const basePath = resolveBasePath();

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({ out: 'build' }),
		paths: {
			base: basePath,
			// Force absolute URLs for assets/links. SvelteKit 2 defaults to
			// `relative: true`, which breaks when the app is mounted at a
			// nested base path (e.g. /apps/<uuid>/v1/) and accessed without
			// a trailing slash — the browser resolves "../../_app/..." against
			// the wrong directory and 404s every JS/CSS chunk.
			relative: false
		},
		csrf: {
			// Workspace apps are served behind the main app's reverse proxy.
			// The browser's Origin header carries the main app's URL, not the
			// workspace's 127.0.0.1:<port> listener, so SvelteKit's built-in
			// CSRF check would reject every non-GET request with 403.
			// Security is still enforced: the main app validates the session
			// cookie before proxying, and the session cookie has SameSite=Lax.
			checkOrigin: false
		}
	}
};

export default config;
