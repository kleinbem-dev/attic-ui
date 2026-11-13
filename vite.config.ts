import { defineWebConfig } from '@kleinbem/web-config/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, '.', 'ATTIC_');
	const target = env.ATTIC_PROXY_TARGET || 'https://cache.nixos.org';

	// Local dev/preview proxy sidesteps browser CORS against caches without CORS headers.
	const proxy = {
		'/proxy-cache': {
			target,
			changeOrigin: true,
			rewrite: (path: string) => path.replace(/^\/proxy-cache/, '')
		}
	};

	const base = defineWebConfig({
		adapter: 'static',
		adapterOptions: {
			fallback: '200.html',
			pages: 'build',
			assets: 'build'
		},
		server: {
			port: 4173,
			host: true,
			proxy
		}
	});

	return {
		...base,
		preview: {
			port: 4173,
			host: true,
			proxy
		}
	};
});
