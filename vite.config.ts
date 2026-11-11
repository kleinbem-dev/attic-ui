import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Dev and preview both proxy the cache to sidestep CORS on localhost.
const proxy = {
	'/proxy-cache': {
		target: 'https://cache.kleinbem.dev',
		changeOrigin: true,
		rewrite: (path: string) => path.replace(/^\/proxy-cache/, '')
	}
};

export default defineConfig({
	server: {
		port: 4173,
		host: true,
		proxy
	},
	preview: {
		port: 4173,
		host: true,
		proxy
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			adapter: adapter({
				fallback: '200.html',
				pages: 'build',
				assets: 'build',
				strict: true
			}),
			compilerOptions: {
				experimental: {
					async: true
				},
				fragments: 'html'
			},
			dynamicCompileOptions({ filename }) {
				if (!filename.includes('node_modules')) {
					return { runes: true };
				}
			},
			experimental: {
				forkPreloads: true
			}
		})
	]
});
