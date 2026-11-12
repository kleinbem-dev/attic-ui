<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '#lib/components/Header.svelte';
	import CacheTelemetry from '#lib/components/CacheTelemetry.svelte';
	import NarinfoInspector from '#lib/components/NarinfoInspector.svelte';
	import ClientConfig from '#lib/components/ClientConfig.svelte';
	import { queryCacheInfo, fetchNarInfo, tokenWithheld } from '#lib/attic-api';
	import type { NarInfo, CacheStatus } from '#lib/types';

	let endpoint = $state('https://attic.kleinbem.dev');
	let cacheName = $state('system');
	let token = $state('');
	let status = $state<CacheStatus>('unknown');
	let latencyMs = $state<number | null>(null);
	let errorMessage = $state('');
	let isPrivateNotice = $state(false);

	let activeNarInfo = $state<NarInfo | null>(null);
	let isInspecting = $state(false);
	let inspectorError = $state('');
	let inspectionSource = $state('');

	// Bumped per test so results of tests for older settings are dropped.
	let testRun = 0;
	let inspectRun = 0;

	async function testConnection() {
		const run = ++testRun;
		errorMessage = '';
		isPrivateNotice = false;
		status = 'checking';
		const res = await queryCacheInfo(endpoint, cacheName, token);
		if (run !== testRun) return;
		latencyMs = res.latencyMs;

		if (res.ok) {
			status = 'healthy';
			isPrivateNotice = false;
		} else if (res.status === 401) {
			if (token.trim()) {
				// A token was supplied but rejected by the cache
				status = 'down';
				isPrivateNotice = false;
				errorMessage = tokenWithheld(endpoint, token)
					? (res.error || '')
					: 'Authentication failed: Token was rejected by the cache';
			} else {
				// Anonymous request to private cache: normal operational state
				status = 'healthy';
				isPrivateNotice = true;
				errorMessage = tokenWithheld(endpoint, token) ? (res.error || '') : '';
			}
		} else {
			status = 'down';
			isPrivateNotice = false;
			errorMessage = res.error || `HTTP ${res.status}`;
		}
	}

	async function inspectPath(hashOrPath: string) {
		const run = ++inspectRun;
		isInspecting = true;
		inspectorError = '';
		inspectionSource = '';
		activeNarInfo = null;
		const targetEndpoint = endpoint;
		const targetCache = cacheName;
		const targetToken = token;

		try {
			let res = await fetchNarInfo(targetEndpoint, targetCache, hashOrPath, targetToken);
			if (run !== inspectRun) return;

			let source = targetEndpoint;
			// no-link: Attic skips caching upstream paths signed by public cache keys (upstreamCacheKeyNames).
			const isKleinbemCache = (() => {
				try {
					const host = new URL(targetEndpoint).hostname;
					return host === 'attic.kleinbem.dev' || host === 'cache.kleinbem.dev' || host.endsWith('.kleinbem.dev');
				} catch {
					return false;
				}
			})();
			if (!res.ok && res.status === 404 && isKleinbemCache) {
				const fallback = await fetchNarInfo('https://cache.nixos.org', '', hashOrPath);
				if (run !== inspectRun) return;
				if (fallback.ok && fallback.data) {
					res = fallback;
					source = 'cache.nixos.org (upstream public)';
				}
			}

			if (run !== inspectRun) return;

			if (res.ok && res.data) {
				activeNarInfo = res.data;
				inspectionSource = source;
			} else if (res.status === 401) {
				inspectorError = 'Private fleet closure. Paste your bearer token in the Cache Endpoint card above to view this path.';
			} else {
				inspectorError = res.error || 'Failed to inspect path';
			}
		} catch (err: unknown) {
			if (run !== inspectRun) return;
			inspectorError = err instanceof Error ? err.message : 'Network error querying cache';
		} finally {
			if (run === inspectRun) {
				isInspecting = false;
			}
		}
	}

	onMount(() => {
		try {
			const savedEndpoint = localStorage.getItem('attic-endpoint');
			const savedCache = localStorage.getItem('attic-cache');
			const savedToken = localStorage.getItem('attic-token');

			if (savedEndpoint) {
				endpoint = savedEndpoint;
			} else if (
				typeof window !== 'undefined' &&
				(window.location.hostname === 'kleinbem.dev' || window.location.hostname.endsWith('.kleinbem.dev'))
			) {
				endpoint = window.location.origin;
			}
			if (savedCache) cacheName = savedCache;
			if (savedToken) token = savedToken;
		} catch (e) {}

		testConnection();

		// Auto-populate inspector on first visit so the explorer is never empty
		if (!activeNarInfo) {
			inspectPath('9l0j15jg8634hkb6d4c9y95mpxl0nhrd');
		}

		const listener = () => testConnection();
		window.addEventListener('attic:test-connection', listener);
		return () => {
			window.removeEventListener('attic:test-connection', listener);
		};
	});

	// Retest shortly after the connection settings change, so the status never describes old ones.
	let mounted = false;
	$effect(() => {
		endpoint;
		cacheName;
		token;
		if (!mounted) {
			mounted = true;
			return;
		}
		testRun++; // drop results of tests started for the old settings
		status = 'unknown';
		latencyMs = null;
		const timer = setTimeout(testConnection, 600);
		return () => clearTimeout(timer);
	});

	$effect(() => {
		try {
			localStorage.setItem('attic-endpoint', endpoint);
			localStorage.setItem('attic-cache', cacheName);
			localStorage.setItem('attic-token', token);
		} catch (e) {}
	});
</script>

<Header {status} {latencyMs} />

<main class="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
	<!-- Hero Intro Banner -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
		<div>
			<h2 class="text-2xl font-bold tracking-tight text-text-primary">
				Deduplicated Binary Cache Explorer
			</h2>
			<p class="text-sm text-text-muted mt-1">
				Real-time monitoring, store closure inspection, and client configurations for Attic.
			</p>
		</div>

		<div class="flex items-center gap-2 text-xs">
			<span class="rounded-full bg-brand/10 border border-brand/20 px-3 py-1 font-mono text-brand">
				Active Cache: {cacheName}
			</span>
		</div>
	</div>

	<!-- Connection & Architecture Telemetry -->
	<CacheTelemetry
		bind:endpoint
		bind:cacheName
		bind:token
		{status}
		{latencyMs}
		{errorMessage}
		{isPrivateNotice}
		onTestConnection={testConnection}
	/>

	<!-- Store Path & Closure Inspector -->
	<NarinfoInspector
		narInfo={activeNarInfo}
		isLoading={isInspecting}
		error={inspectorError}
		source={inspectionSource}
		onSearch={inspectPath}
	/>

	<!-- Client Setup & Quickstart Snippets -->
	<ClientConfig {endpoint} {cacheName} />
</main>

<footer class="border-t border-border-subtle bg-bg-surface/50 py-6 mt-12">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
		<div class="flex items-center gap-2">
			<span>📦</span>
			<span>Powered by <strong>Attic</strong> & <strong>@kleinbem/web-config</strong></span>
		</div>
		<div>
			<span>kleinbem fleet infrastructure</span>
		</div>
	</div>
</footer>
