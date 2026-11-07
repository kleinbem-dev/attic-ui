<script lang="ts">
	import Header from '#lib/components/Header.svelte';
	import CacheTelemetry from '#lib/components/CacheTelemetry.svelte';
	import NarinfoInspector from '#lib/components/NarinfoInspector.svelte';
	import ClientConfig from '#lib/components/ClientConfig.svelte';
	import { queryCacheInfo, fetchNarInfo } from '#lib/attic-api';
	import type { NarInfo, CacheStatus } from '#lib/types';

	let endpoint = $state('https://cache.kleinbem.dev');
	let cacheName = $state('system');
	let token = $state('');
	let status = $state<CacheStatus>('unknown');
	let latencyMs = $state<number | null>(null);
	let errorMessage = $state('');

	let activeNarInfo = $state<NarInfo | null>(null);
	let isInspecting = $state(false);
	let inspectorError = $state('');

	async function testConnection() {
		errorMessage = '';
		const res = await queryCacheInfo(endpoint, cacheName, token);
		latencyMs = res.latencyMs;

		if (res.ok) {
			status = 'healthy';
		} else if (res.status === 401) {
			status = 'degraded';
			errorMessage = 'Unauthorized: Token required to pull from this cache.';
		} else {
			status = 'down';
			errorMessage = res.error || `HTTP ${res.status}`;
		}
	}

	async function inspectPath(hashOrPath: string) {
		isInspecting = true;
		inspectorError = '';
		try {
			const res = await fetchNarInfo(endpoint, cacheName, hashOrPath, token);
			if (res.ok && res.data) {
				activeNarInfo = res.data;
			} else {
				inspectorError = res.error || 'Failed to inspect path';
			}
		} catch (err: unknown) {
			inspectorError = err instanceof Error ? err.message : 'Network error querying cache';
		} finally {
			isInspecting = false;
		}
	}

	$effect(() => {
		try {
			const savedEndpoint = localStorage.getItem('attic-endpoint');
			const savedCache = localStorage.getItem('attic-cache');
			const savedToken = localStorage.getItem('attic-token');

			if (savedEndpoint) endpoint = savedEndpoint;
			if (savedCache) cacheName = savedCache;
			if (savedToken) token = savedToken;
		} catch (e) {}

		// Run an initial connectivity check
		testConnection();

		const listener = () => testConnection();
		window.addEventListener('attic:test-connection', listener);
		return () => {
			window.removeEventListener('attic:test-connection', listener);
		};
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
		onTestConnection={testConnection}
	/>

	<!-- Store Path & Closure Inspector -->
	<NarinfoInspector
		narInfo={activeNarInfo}
		isLoading={isInspecting}
		error={inspectorError}
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
