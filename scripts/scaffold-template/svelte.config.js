import adapter from '@sveltejs/adapter-node';

function normalizeBasePath(path) {
	if (!path) return '';
	path = path.replace(/\/+$/, '');
	if (!path.startsWith('/')) path = '/' + path;
	return path;
}

const basePath = normalizeBasePath(process.env.BASE_PATH);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({ out: 'build' }),
		paths: { base: basePath }
	}
};

export default config;
