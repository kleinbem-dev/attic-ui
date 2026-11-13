<script lang="ts">
	import { onDestroy } from 'svelte';
	import StatusDot from '@kleinbem/web-config/components/StatusDot';
	import { isLoopbackHost, isPublicNixCache, parseEndpointUrl } from '#lib/attic-api';
	import { ClipboardFeedback } from '#lib/clipboard.svelte';
	import type { CacheInfo, CachePreset, CacheStatus } from '#lib/types';

	let {
		endpoint,
		cacheName,
		token,
		status = 'unknown',
		latencyMs = null,
		cacheInfo = null,
		errorMessage = '',
		isPrivateNotice = false,
		presets = [],
		publicKey = null,
		specs = {},
		onEndpointChange,
		onCacheNameChange,
		onTokenChange,
		onSelectPreset,
		onTestConnection
	}: {
		endpoint: string;
		cacheName: string;
		token: string;
		status: CacheStatus;
		latencyMs: number | null;
		cacheInfo?: CacheInfo | null;
		errorMessage?: string;
		isPrivateNotice?: boolean;
		presets?: CachePreset[];
		publicKey?: string | null;
		specs?: Record<string, string>;
		onEndpointChange: (value: string) => void;
		onCacheNameChange: (value: string) => void;
		onTokenChange: (value: string) => void;
		onSelectPreset: (preset: CachePreset) => void;
		onTestConnection: () => Promise<void> | void;
	} = $props();

	let showToken = $state(false);
	let isTesting = $state(false);
	const clipboard = new ClipboardFeedback();
	onDestroy(() => clipboard.destroy());

	const parsedUrl = $derived(parseEndpointUrl(endpoint));
	const transportLabel = $derived.by(() => {
		if (!parsedUrl) return 'Invalid URL';
		if (parsedUrl.protocol === 'https:') return 'HTTPS (TLS)';
		if (isLoopbackHost(parsedUrl.hostname)) return 'Loopback HTTP';
		return 'Plain HTTP (tokens withheld)';
	});

	const cacheModeLabel = $derived.by(() => {
		if (isPublicNixCache(endpoint)) return 'Public NixOS Cache';
		const trimmed = cacheName.trim();
		return trimmed ? `Multi-tenant (/${trimmed})` : 'Root Binary Cache';
	});

	const specEntries = $derived(Object.entries(specs));

	async function handleTest() {
		isTesting = true;
		try {
			await onTestConnection();
		} finally {
			isTesting = false;
		}
	}
</script>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
	<section aria-labelledby="endpoint-card-heading" class="glass-panel rounded-2xl p-5 lg:col-span-2 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b border-line pb-3">
			<div class="flex items-center gap-2">
				<span aria-hidden="true" class="text-base">⚡</span>
				<h2 id="endpoint-card-heading" class="text-sm font-semibold text-heading">
					Cache Endpoint & Authentication
				</h2>
			</div>
			<div class="flex items-center gap-2 text-xs">
				<StatusDot {status} pulse={status === 'healthy'} size="sm" />
				<span class="text-muted capitalize">{status}</span>
				{#if latencyMs !== null}
					<span class="font-mono text-fg">({latencyMs}ms)</span>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div>
				<label for="endpoint-input" class="block text-xs font-medium text-fg mb-1">
					Server URL
				</label>
				<input
					id="endpoint-input"
					type="url"
					value={endpoint}
					oninput={(e) => onEndpointChange(e.currentTarget.value)}
					placeholder="https://cache.nixos.org"
					spellcheck="false"
					class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs font-mono text-heading focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
				/>
			</div>

			<div>
				<label for="cache-name-input" class="block text-xs font-medium text-fg mb-1">
					Cache Name <span class="text-muted font-normal">(blank for root caches)</span>
				</label>
				<input
					id="cache-name-input"
					type="text"
					value={cacheName}
					oninput={(e) => onCacheNameChange(e.currentTarget.value)}
					placeholder="main"
					spellcheck="false"
					class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs font-mono text-heading focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
				/>
			</div>
		</div>

		{#if presets.length > 0}
			<div class="flex flex-wrap items-center gap-2 text-[11px] text-muted">
				<span>Presets:</span>
				{#each presets as preset (`${preset.endpoint}::${preset.cacheName}`)}
					<button
						type="button"
						onclick={() => onSelectPreset(preset)}
						class="rounded px-2 py-1 border border-line bg-bg hover:text-accent hover:border-accent/40 transition-colors font-mono cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
					>
						{preset.label}
					</button>
				{/each}
			</div>
		{/if}

		<div>
			<div class="flex items-center justify-between mb-1">
				<label for="token-input" class="block text-xs font-medium text-fg">
					Authentication Bearer Token <span class="text-muted font-normal">(optional, scoped per origin)</span>
				</label>
				<button
					type="button"
					aria-pressed={showToken}
					onclick={() => (showToken = !showToken)}
					class="text-[11px] text-accent hover:underline cursor-pointer px-1 rounded focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
				>
					{showToken ? 'Hide' : 'Show'}
				</button>
			</div>
			<input
				id="token-input"
				type={showToken ? 'text' : 'password'}
				value={token}
				oninput={(e) => onTokenChange(e.currentTarget.value)}
				autocomplete="off"
				spellcheck="false"
				placeholder="eyJhbGciOi..."
				class="w-full rounded-lg border border-line bg-bg px-3 py-2 text-xs font-mono text-heading focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
			/>
		</div>

		{#if errorMessage}
			<div
				role="alert"
				class="rounded-lg bg-status-danger/10 border border-status-danger/20 px-3 py-2 text-xs text-status-danger flex items-center justify-between gap-2"
			>
				<span>{errorMessage}</span>
				<span class="text-[10px] uppercase font-mono shrink-0">Status Error</span>
			</div>
		{:else if isPrivateNotice && !token}
			<div
				role="status"
				class="rounded-lg bg-accent/10 border border-accent/20 px-3.5 py-2.5 text-xs text-heading flex items-center justify-between gap-3"
			>
				<div class="flex items-center gap-2">
					<span aria-hidden="true" class="text-sm">🔒</span>
					<span>Cache is reachable and operational. Supply a bearer token to inspect private store paths.</span>
				</div>
				<span class="text-[10px] font-mono text-accent font-semibold uppercase tracking-wider shrink-0">Private Cache</span>
			</div>
		{/if}

		<div class="flex items-center justify-end gap-3 pt-1">
			<button
				type="button"
				onclick={handleTest}
				disabled={isTesting}
				class="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-medium text-accent-fg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			>
				{#if isTesting}
					<span aria-hidden="true" class="animate-spin text-xs">⟳</span>
					<span>Testing...</span>
				{:else}
					<span>Test Connection</span>
				{/if}
			</button>
		</div>
	</section>

	<section aria-labelledby="telemetry-card-heading" class="glass-panel rounded-2xl p-5 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b border-line pb-3">
			<div class="flex items-center gap-2">
				<span aria-hidden="true" class="text-base">⚙️</span>
				<h2 id="telemetry-card-heading" class="text-sm font-semibold text-heading">
					Cache Telemetry
				</h2>
			</div>
			{#if cacheInfo}
				<button
					type="button"
					onclick={() => clipboard.copy(String(cacheInfo.priority), 'priority')}
					class="rounded bg-accent/10 hover:bg-accent/20 px-2 py-0.5 font-mono text-[10px] font-semibold {clipboard.failedId === 'priority' ? 'text-status-danger' : 'text-accent'} transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
					aria-label="Copy cache priority {cacheInfo.priority}"
				>
					{clipboard.copiedId === 'priority'
						? '✓ Copied'
						: clipboard.failedId === 'priority'
							? 'Copy failed'
							: `Priority ${cacheInfo.priority}`}
				</button>
			{/if}
		</div>

		<dl class="space-y-3 text-xs">
			<div class="flex items-center justify-between gap-2">
				<dt class="text-muted">Origin</dt>
				<dd class="font-medium font-mono text-heading truncate">{parsedUrl?.host ?? '—'}</dd>
			</div>

			<div class="flex items-center justify-between gap-2">
				<dt class="text-muted">Transport</dt>
				<dd class="font-medium text-heading">{transportLabel}</dd>
			</div>

			<div class="flex items-center justify-between gap-2">
				<dt class="text-muted">Routing Mode</dt>
				<dd class="font-mono text-fg truncate">{cacheModeLabel}</dd>
			</div>

			<div class="flex items-center justify-between gap-2">
				<dt class="text-muted">StoreDir</dt>
				<dd class="font-mono text-fg">{cacheInfo?.storeDir ?? '—'}</dd>
			</div>

			<div class="flex items-center justify-between gap-2">
				<dt class="text-muted">WantMassQuery</dt>
				<dd class="font-mono text-fg">
					{cacheInfo ? (cacheInfo.wantMassQuery ? '1 (enabled)' : '0 (disabled)') : '—'}
				</dd>
			</div>

			{#each specEntries as [label, value] (label)}
				<div class="flex items-center justify-between gap-2">
					<dt class="text-muted">{label}</dt>
					<dd class="font-mono text-fg truncate">{value}</dd>
				</div>
			{/each}
		</dl>

		{#if publicKey}
			<div class="border-t border-line pt-3 space-y-1.5">
				<div class="flex items-center justify-between">
					<span class="text-[11px] font-medium text-muted uppercase tracking-wider">
						Public Signing Key
					</span>
					<button
						type="button"
						onclick={() => clipboard.copy(publicKey, 'pubkey')}
						class="text-[10px] font-mono {clipboard.failedId === 'pubkey' ? 'text-status-danger' : 'text-accent'} hover:underline cursor-pointer rounded px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
					>
						{clipboard.copiedId === 'pubkey'
							? '✓ Copied'
							: clipboard.failedId === 'pubkey'
								? 'Failed to copy'
								: 'Copy Key'}
					</button>
				</div>
				<div class="rounded border border-line bg-bg px-2 py-1 font-mono text-[10px] text-fg break-all">
					{publicKey}
				</div>
			</div>
		{/if}
	</section>
</div>
