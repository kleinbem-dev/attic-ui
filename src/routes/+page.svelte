<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import CommandPalette from '@kleinbem/web-config/components/CommandPalette';
	import type { CommandItem } from '@kleinbem/web-config/components/CommandPalette';
	import { theme } from '@kleinbem/web-config/theme/state';
	import Header from '#lib/components/Header.svelte';
	import CacheTelemetry from '#lib/components/CacheTelemetry.svelte';
	import NarinfoInspector from '#lib/components/NarinfoInspector.svelte';
	import ClientConfig, { type ConfigTab } from '#lib/components/ClientConfig.svelte';
	import { ClipboardFeedback } from '#lib/clipboard.svelte';
	import {
		buildClientSnippets,
		buildPresets,
		DEFAULT_UPSTREAM_SAMPLES,
		endpointOrigin,
		extractStoreHash,
		fetchNarInfo,
		isPublicNixCache,
		loadRuntimeConfig,
		loadTokenForEndpoint,
		PUBLIC_NIXOS_CACHE,
		queryCacheInfo,
		resolveEndpoint,
		resolveInitialTarget,
		resolvePublicKey,
		saveTokenForEndpoint,
		tokenWithheld,
		updateBreadcrumbTrail
	} from '#lib/attic-api';
	import type {
		BreadcrumbItem,
		CacheInfo,
		CachePreset,
		CacheStatus,
		NarInfo,
		RuntimeConfig,
		SamplePath
	} from '#lib/types';

	let runtimeConfig = $state.raw<RuntimeConfig>({});
	let endpoint = $state(PUBLIC_NIXOS_CACHE);
	let cacheName = $state('');
	let token = $state('');
	let status = $state<CacheStatus>('unknown');
	let latencyMs = $state<number | null>(null);
	let cacheInfo = $state.raw<CacheInfo | null>(null);
	let errorMessage = $state('');
	let isPrivateNotice = $state(false);

	let activeNarInfo = $state.raw<NarInfo | null>(null);
	let isInspecting = $state(false);
	let inspectorError = $state('');
	let inspectionSource = $state('');
	let inspectedTarget = $state.raw<{ endpoint: string; cacheName: string } | null>(null);
	let historyTrail = $state.raw<BreadcrumbItem[]>([]);

	let configTab = $state<ConfigTab>('nixos');
	let commandPaletteOpen = $state(false);
	let inspectorRef = $state<ReturnType<typeof NarinfoInspector> | null>(null);

	let mountController: AbortController | null = null;
	let testController: AbortController | null = null;
	let inspectController: AbortController | null = null;
	let retestTimer: ReturnType<typeof setTimeout> | null = null;

	const paletteClipboard = new ClipboardFeedback();

	onDestroy(() => {
		mountController?.abort();
		testController?.abort();
		inspectController?.abort();
		if (retestTimer) clearTimeout(retestTimer);
		paletteClipboard.destroy();
	});

	const presets = $derived(buildPresets(runtimeConfig));
	const publicKey = $derived(resolvePublicKey(endpoint, cacheName, runtimeConfig.publicKeys));
	const activeCacheLabel = $derived(
		isPublicNixCache(endpoint) ? 'cache.nixos.org' : cacheName.trim() || 'root'
	);

	const samples = $derived.by((): SamplePath[] => {
		const combined = [...(runtimeConfig.samples ?? []), ...DEFAULT_UPSTREAM_SAMPLES];
		const seen = new Set<string>();
		return combined.filter((item) => {
			if (seen.has(item.hash)) return false;
			seen.add(item.hash);
			return true;
		});
	});

	const commandItems = $derived.by((): CommandItem[] => {
		const snippets = buildClientSnippets(endpoint, cacheName, publicKey);
		const presetItems: CommandItem[] = presets.map((preset) => ({
			id: `preset-${preset.endpoint}-${preset.cacheName}`,
			title: `Switch Cache: ${preset.label}${preset.cacheName ? ` / ${preset.cacheName}` : ''}`,
			subtitle: preset.endpoint,
			category: 'Presets',
			icon: '🗄️',
			onSelect: () => handleSelectPreset(preset)
		}));

		return [
			{
				id: 'inspect-path',
				title: 'Inspect Nix Store Path',
				category: 'Actions',
				icon: '🔍',
				onSelect: () => queueMicrotask(() => inspectorRef?.focusSearch())
			},
			{
				id: 'test-connection',
				title: 'Test Binary Cache Connection',
				category: 'Actions',
				icon: '⚡',
				onSelect: () => void testConnection()
			},
			...presetItems,
			{
				id: 'copy-nixos',
				title: 'Copy NixOS substituters configuration',
				category: 'Configuration',
				icon: '📋',
				badge: 'NixOS',
				onSelect: () => {
					configTab = 'nixos';
					void paletteClipboard.copy(snippets.nixos, 'NixOS snippet');
				}
			},
			{
				id: 'copy-nixconf',
				title: 'Copy nix.conf substituters',
				category: 'Configuration',
				icon: '📄',
				badge: 'nix.conf',
				onSelect: () => {
					configTab = 'nixconf';
					void paletteClipboard.copy(snippets.nixconf, 'nix.conf snippet');
				}
			},
			{
				id: 'copy-cli',
				title: 'Copy Attic CLI commands',
				category: 'Configuration',
				icon: '💻',
				badge: 'CLI',
				onSelect: () => {
					configTab = 'cli';
					void paletteClipboard.copy(snippets.cli, 'CLI snippet');
				}
			},
			{
				id: 'theme-dark',
				title: 'Switch to Dark Theme',
				category: 'Preferences',
				icon: '🌙',
				onSelect: () => theme.set('dark')
			},
			{
				id: 'theme-light',
				title: 'Switch to Light Theme',
				category: 'Preferences',
				icon: '☀️',
				onSelect: () => theme.set('light')
			},
			{
				id: 'theme-system',
				title: 'Follow System Theme',
				category: 'Preferences',
				icon: '🖥️',
				onSelect: () => theme.set('system')
			}
		];
	});

	function persistTarget(nextEndpoint: string, nextCache: string): void {
		try {
			const cleanEp = resolveEndpoint(nextEndpoint);
			if (cleanEp) localStorage.setItem('attic-endpoint', cleanEp);
			localStorage.setItem('attic-cache', nextCache);
		} catch {
			// Ignore private-browsing storage errors.
		}
	}

	function scheduleRetest(): void {
		testController?.abort();
		if (retestTimer) clearTimeout(retestTimer);
		status = 'unknown';
		latencyMs = null;
		cacheInfo = null;
		errorMessage = '';
		isPrivateNotice = false;
		retestTimer = setTimeout(() => {
			retestTimer = null;
			void testConnection();
		}, 500);
	}

	function handleEndpointChange(nextEndpoint: string): void {
		if (endpointOrigin(nextEndpoint) !== endpointOrigin(endpoint)) {
			token = loadTokenForEndpoint(localStorage, nextEndpoint);
		}
		endpoint = nextEndpoint;
		persistTarget(nextEndpoint, cacheName);
		scheduleRetest();
	}

	function handleCacheNameChange(nextCache: string): void {
		cacheName = nextCache;
		persistTarget(endpoint, nextCache);
		scheduleRetest();
	}

	function handleTokenChange(nextToken: string): void {
		token = nextToken;
		saveTokenForEndpoint(localStorage, endpoint, nextToken);
		scheduleRetest();
	}

	function handleSelectPreset(preset: CachePreset): void {
		if (endpointOrigin(preset.endpoint) !== endpointOrigin(endpoint)) {
			token = loadTokenForEndpoint(localStorage, preset.endpoint);
		}
		endpoint = preset.endpoint;
		cacheName = preset.cacheName;
		persistTarget(preset.endpoint, preset.cacheName);
		void testConnection();
	}

	async function testConnection(): Promise<void> {
		if (retestTimer) {
			clearTimeout(retestTimer);
			retestTimer = null;
		}
		testController?.abort();
		const controller = new AbortController();
		testController = controller;

		errorMessage = '';
		isPrivateNotice = false;
		cacheInfo = null;
		status = 'checking';

		const res = await queryCacheInfo(endpoint, cacheName, token, controller.signal);
		if (controller.signal.aborted) return;

		latencyMs = res.latencyMs;
		cacheInfo = res.info ?? null;

		if (res.ok) {
			status = 'healthy';
		} else if (res.status === 401) {
			if (token.trim()) {
				status = 'down';
				errorMessage = tokenWithheld(endpoint, token)
					? (res.error ?? '')
					: 'Authentication failed: Bearer token was rejected by the cache';
			} else {
				status = 'healthy';
				isPrivateNotice = true;
			}
		} else {
			status = 'down';
			errorMessage = res.error ?? `HTTP ${res.status}`;
		}
	}

	async function inspectPath(hashOrPath: string, syncHistory = true): Promise<void> {
		inspectController?.abort();
		const controller = new AbortController();
		inspectController = controller;

		isInspecting = true;
		inspectorError = '';
		inspectionSource = '';
		activeNarInfo = null;

		const targetEndpoint = endpoint;
		const targetCache = cacheName;
		const targetToken = token;

		try {
			let res = await fetchNarInfo(
				targetEndpoint,
				targetCache,
				hashOrPath,
				targetToken,
				controller.signal
			);
			if (controller.signal.aborted) return;

			let effectiveEndpoint = targetEndpoint;
			let effectiveCache = targetCache;
			let source = resolveEndpoint(targetEndpoint) || targetEndpoint;

			// Attic servers configured with upstreamCacheKeyNames omit upstream NixOS paths locally.
			if (
				!res.ok &&
				res.status === 404 &&
				!isPublicNixCache(targetEndpoint) &&
				runtimeConfig.upstreamFallback !== false
			) {
				const fallback = await fetchNarInfo(
					PUBLIC_NIXOS_CACHE,
					'',
					hashOrPath,
					undefined,
					controller.signal
				);
				if (controller.signal.aborted) return;
				if (fallback.ok && fallback.data) {
					res = fallback;
					source = 'cache.nixos.org (upstream fallback)';
					effectiveEndpoint = PUBLIC_NIXOS_CACHE;
					effectiveCache = '';
				}
			}

			if (res.ok && res.data) {
				activeNarInfo = res.data;
				inspectionSource = source;
				inspectedTarget = { endpoint: effectiveEndpoint, cacheName: effectiveCache };
				historyTrail = updateBreadcrumbTrail(historyTrail, res.data.storePath);

				if (syncHistory) {
					try {
						const url = new URL(window.location.href);
						const hash = extractStoreHash(res.data.storePath);
						if (hash && url.searchParams.get('path') !== hash) {
							url.searchParams.set('path', hash);
							window.history.replaceState({}, '', url.toString());
						}
					} catch {
						// Ignore history errors in restricted frames.
					}
				}
			} else if (res.status === 401) {
				inspectorError = tokenWithheld(targetEndpoint, targetToken)
					? (res.error ?? '')
					: 'Private binary cache path. Enter a bearer token in Cache Endpoint above to inspect this closure.';
			} else {
				inspectorError = res.error ?? 'Failed to inspect path';
			}
		} catch (err: unknown) {
			if (controller.signal.aborted) return;
			inspectorError = err instanceof Error ? err.message : 'Network error querying cache';
		} finally {
			if (!controller.signal.aborted) {
				isInspecting = false;
			}
		}
	}

	onMount(() => {
		const controller = new AbortController();
		mountController = controller;

		const handlePopState = () => {
			const pathParam = new URLSearchParams(window.location.search).get('path');
			if (pathParam) void inspectPath(pathParam, false);
		};
		window.addEventListener('popstate', handlePopState);

		void (async () => {
			const cfg = await loadRuntimeConfig(controller.signal);
			if (controller.signal.aborted) return;
			runtimeConfig = cfg;

			const params = new URLSearchParams(window.location.search);
			const initial = resolveInitialTarget(params, localStorage, cfg, window.location.origin);
			endpoint = initial.endpoint;
			cacheName = initial.cacheName;
			token = loadTokenForEndpoint(localStorage, initial.endpoint, window.location.origin);

			const initialPath =
				params.get('path') || cfg.samples?.[0]?.hash || DEFAULT_UPSTREAM_SAMPLES[0].hash;
			void testConnection();
			void inspectPath(initialPath, Boolean(params.get('path')));
		})();

		return () => {
			window.removeEventListener('popstate', handlePopState);
			controller.abort();
		};
	});
</script>

<Header
	{status}
	{latencyMs}
	subtitle={runtimeConfig.subtitle}
	onOpenCommandPalette={() => (commandPaletteOpen = true)}
/>

<main
	id="main-content"
	class="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8"
>
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
		<div>
			<h2 class="text-2xl font-bold tracking-tight text-heading">
				Deduplicated Binary Cache Explorer
			</h2>
			<p class="text-sm text-muted mt-1">
				Live cache metadata, Nix store closure inspection, and client setup snippets for Attic.
			</p>
		</div>

		<div class="flex items-center gap-2 text-xs">
			<span class="rounded-full bg-accent/10 border border-accent/20 px-3 py-1 font-mono text-accent">
				Active Cache: {activeCacheLabel}
			</span>
		</div>
	</div>

	<CacheTelemetry
		{endpoint}
		{cacheName}
		{token}
		{status}
		{latencyMs}
		{cacheInfo}
		{errorMessage}
		{isPrivateNotice}
		{presets}
		{publicKey}
		specs={runtimeConfig.specs}
		onEndpointChange={handleEndpointChange}
		onCacheNameChange={handleCacheNameChange}
		onTokenChange={handleTokenChange}
		onSelectPreset={handleSelectPreset}
		onTestConnection={testConnection}
	/>

	<NarinfoInspector
		bind:this={inspectorRef}
		narInfo={activeNarInfo}
		isLoading={isInspecting}
		error={inspectorError}
		source={inspectionSource}
		endpoint={inspectedTarget ? inspectedTarget.endpoint : endpoint}
		cacheName={inspectedTarget ? inspectedTarget.cacheName : cacheName}
		storeDir={cacheInfo?.storeDir}
		{samples}
		{historyTrail}
		onSearch={(path) => void inspectPath(path)}
	/>

	<ClientConfig
		{endpoint}
		{cacheName}
		{publicKey}
		bind:activeTab={configTab}
	/>
</main>

<footer class="border-t border-line bg-bg/50 py-6 mt-12">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
		<div class="flex items-center gap-2">
			<span aria-hidden="true">📦</span>
			<span>Powered by <strong>Attic</strong></span>
		</div>
		{#if runtimeConfig.footer}
			<div>
				<span>{runtimeConfig.footer}</span>
			</div>
		{/if}
	</div>
</footer>

{#if paletteClipboard.copiedId || paletteClipboard.failedId}
	<div
		role="status"
		aria-live="polite"
		class="fixed bottom-4 right-4 z-40 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg backdrop-blur-md {paletteClipboard.failedId
			? 'border-status-danger/40 bg-status-danger/15 text-status-danger'
			: 'border-status-success/40 bg-status-success/15 text-status-success'}"
	>
		{#if paletteClipboard.failedId}
			Clipboard copy failed for {paletteClipboard.failedId}
		{:else}
			✓ Copied {paletteClipboard.copiedId} to clipboard
		{/if}
	</div>
{/if}

<CommandPalette
	bind:open={commandPaletteOpen}
	items={commandItems}
	placeholder="Search actions, presets, or configuration..."
/>
