import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			out: 'build'
		}),
		paths: {
			// Base path for serving the app (e.g., '/myapp' to serve at http://hostname/myapp)
			// Set via BASE_PATH environment variable at build time
			base: process.env.BASE_PATH || ''
		}
	}
};

export default config;
