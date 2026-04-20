import adapter from '@sveltejs/adapter-node';

// Normalize base path: ensure it starts with / and doesn't end with /
function normalizeBasePath(path) {
	if (!path) return '';
	// Remove trailing slashes
	path = path.replace(/\/+$/, '');
	// Ensure leading slash
	if (!path.startsWith('/')) {
		path = '/' + path;
	}
	return path;
}

const basePath = normalizeBasePath(process.env.BASE_PATH);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			out: 'build'
		}),
		paths: {
			// Base path for serving the app (e.g., '/myapp' to serve at http://hostname/myapp)
			// Set via BASE_PATH environment variable at build time
			base: basePath
		},
		csrf: {
			// Disable SvelteKit's built-in CSRF origin check.  The main app proxies
			// form-action requests to workspace MVPs.  SvelteKit's CSRF check rejects
			// these because the proxy route has +server.ts (not +page.server.ts with
			// form actions), causing 403 "Cross-site POST form submissions are forbidden".
			// Security is still enforced:
			//   - All routes require a valid session cookie (hooks.server.ts)
			//   - Workspace MVPs run their own SvelteKit with its own CSRF protection
			//   - The session cookie has SameSite=Lax, preventing true cross-site attacks
			//
			// `trustedOrigins: ['*']` is the SvelteKit 2.x replacement for the
			// deprecated `checkOrigin: false`.
			trustedOrigins: ['*']
		}
	}
};

export default config;
