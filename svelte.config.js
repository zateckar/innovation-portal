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
		}
	}
};

export default config;
