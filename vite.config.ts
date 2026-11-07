import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: 4173,
		host: true,
		proxy: {
			'/proxy-cache': {
				target: 'https://cache.kleinbem.dev',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/proxy-cache/, '')
			}
		}
	},
	preview: {
		port: 4173,
		host: true,
		proxy: {
			'/proxy-cache': {
				target: 'https://cache.kleinbem.dev',
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path.replace(/^\/proxy-cache/, '')
			}
		}
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
