import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

async function listFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir);
	const files: string[] = [];
	for (const name of entries) {
		const full = `${dir}/${name}`;
		try {
			const nested = await listFiles(full);
			files.push(...nested);
		} catch {
			files.push(full);
		}
	}
	return files;
}

describe('Frontend static, security, and accessibility contracts', () => {
	it('app.html declares lang, viewport, color-scheme, and strict theme/font-size bootstrap', async () => {
		const html = await readFile('src/app.html', 'utf8');
		assert.match(html, /<html\s+lang="en"/);
		assert.match(html, /name="viewport"/);
		assert.match(html, /name="color-scheme"\s+content="dark light"/);
		assert.match(html, /localStorage\.getItem\('fleet-theme'\)/);
		assert.match(html, /s === 'small' \|\| s === 'large' \|\| s === 'larger'/);
		assert.match(html, /%sveltekit\.head%/);
		assert.match(html, /%sveltekit\.body%/);
	});

	it('+layout.ts enforces pure static client-side SPA mode', async () => {
		const layoutTs = await readFile('src/routes/+layout.ts', 'utf8');
		assert.match(layoutTs, /export const ssr = false;/);
		assert.match(layoutTs, /export const prerender = true;/);
	});

	it('app.css and package-lock.json adhere to web-config theme and HTTPS git lockfile contracts', async () => {
		const css = await readFile('src/app.css', 'utf8');
		assert.match(css, /@source\s+"\.\.\/node_modules\/@kleinbem\/web-config";/);
		assert.doesNotMatch(css, /@theme\b/);

		const lock = await readFile('package-lock.json', 'utf8');
		assert.doesNotMatch(lock, /git\+ssh:\/\//);
		assert.match(lock, /git\+https:\/\/github\.com\/kleinbem\/web-config\.git#[0-9a-f]{40}/);
	});

	it('wires skip-link navigation, WAI-ARIA tablists, and effect-free component state', async () => {
		const layout = await readFile('src/routes/+layout.svelte', 'utf8');
		const page = await readFile('src/routes/+page.svelte', 'utf8');
		const clientConfig = await readFile('src/lib/components/ClientConfig.svelte', 'utf8');
		const inspector = await readFile('src/lib/components/NarinfoInspector.svelte', 'utf8');
		const telemetry = await readFile('src/lib/components/CacheTelemetry.svelte', 'utf8');

		assert.match(layout, /href="#main-content"/);
		assert.match(page, /<main[\s\S]*?id="main-content"/);

		assert.match(clientConfig, /role="tablist"/);
		assert.match(clientConfig, /role="tab"/);
		assert.match(clientConfig, /role="tabpanel"/);
		assert.match(inspector, /role="tablist"/);
		assert.match(inspector, /role="tabpanel"/);

		// State mutations in page and components are event-driven with zero $effect loops
		assert.doesNotMatch(page, /\$effect\(/);
		assert.doesNotMatch(inspector, /\$effect\(/);
		assert.doesNotMatch(telemetry, /\$effect\(/);
		assert.doesNotMatch(clientConfig, /\$effect\(/);
	});

	it('contains zero hardcoded private fleet IPs, internal hostnames, or signing keys in src/', async () => {
		const files = await listFiles('src');
		for (const file of files) {
			const content = await readFile(file, 'utf8');
			assert.doesNotMatch(content, /10\.85\./, `Private IP leaked in ${file}`);
			assert.doesNotMatch(content, /core-pi/i, `Internal hostname leaked in ${file}`);
			assert.doesNotMatch(
				content,
				/(?:attic|cache)\.kleinbem\.dev/i,
				`Fleet cache hostname hardcoded in ${file}`
			);
			assert.doesNotMatch(content, /dCe\+/, `Fleet public key hardcoded in ${file}`);
			assert.doesNotMatch(
				content,
				/(?:bg-bg-|text-text-|border-subtle|-brand\b|status-healthy|status-critical)/,
				`Legacy unmapped theme token alias in ${file}`
			);
		}
	});

	it('uses only synthetic store hashes in test/ so fetchFromGitHub FOD checks never match stdenv', async () => {
		const files = await listFiles('test');
		for (const file of files) {
			const content = await readFile(file, 'utf8');
			const matches = content.match(/[0-9a-df-np-sv-z]{32}/g) ?? [];
			for (const hash of matches) {
				assert.match(
					hash,
					/^0{28}[0-9a-df-np-sv-z]{4}$/,
					`Non-synthetic Nix store hash '${hash}' in ${file} risks colliding with fetchFromGitHub FOD inputs`
				);
			}
		}
	});
});
