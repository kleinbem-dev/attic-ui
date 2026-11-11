<script lang="ts">
	import StatusDot from '@kleinbem/web-config/components/StatusDot';
	import type { CacheStatus } from '#lib/types';

	let {
		endpoint = $bindable('https://cache.kleinbem.dev'),
		cacheName = $bindable('system'),
		token = $bindable(''),
		status = 'healthy',
		latencyMs = null,
		errorMessage = '',
		onTestConnection
	}: {
		endpoint: string;
		cacheName: string;
		token: string;
		status: CacheStatus;
		latencyMs: number | null;
		errorMessage?: string;
		onTestConnection: () => void;
	} = $props();

	let showToken = $state(false);
	let isTesting = $state(false);

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
	<!-- Connection Configuration Card -->
	<div class="glass-panel rounded-2xl p-5 lg:col-span-2 shadow-xs space-y-4">
		<div class="flex items-center justify-between border-b border-border-subtle pb-3">
			<div class="flex items-center gap-2">
				<span class="text-base">⚡</span>
				<h2 class="text-sm font-semibold text-text-primary">Cache Endpoint & Authentication</h2>
			</div>
			<div class="flex items-center gap-2 text-xs">
				<StatusDot {status} pulse={status === 'healthy'} size="sm" />
				<span class="text-text-muted capitalize">{status}</span>
				{#if latencyMs !== null}
					<span class="font-mono text-text-secondary">({latencyMs}ms)</span>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div>
				<label for="endpoint-input" class="block text-xs font-medium text-text-secondary mb-1">
					Server URL
				</label>
				<input
					id="endpoint-input"
					type="url"
					bind:value={endpoint}
					placeholder="https://cache.kleinbem.dev"
					class="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs font-mono text-text-primary focus:border-brand focus:outline-hidden"
				/>
			</div>

			<div>
				<label for="cache-name-input" class="block text-xs font-medium text-text-secondary mb-1">
					Cache Name
				</label>
				<input
					id="cache-name-input"
					type="text"
					bind:value={cacheName}
					placeholder="system"
					class="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs font-mono text-text-primary focus:border-brand focus:outline-hidden"
				/>
			</div>
		</div>

		<div class="flex items-center gap-2 text-[11px] text-text-muted">
			<span>Presets:</span>
			<button
				type="button"
				onclick={() => { endpoint = 'https://cache.kleinbem.dev'; cacheName = 'system'; }}
				class="rounded px-2 py-0.5 border border-border-subtle bg-bg-surface hover:text-brand hover:border-brand/40 transition-colors font-mono cursor-pointer"
			>
				cache.kleinbem.dev
			</button>
			<button
				type="button"
				onclick={() => { endpoint = 'https://cache.nixos.org'; cacheName = ''; }}
				class="rounded px-2 py-0.5 border border-border-subtle bg-bg-surface hover:text-brand hover:border-brand/40 transition-colors font-mono cursor-pointer"
			>
				cache.nixos.org
			</button>
		</div>

		<div>
			<div class="flex items-center justify-between mb-1">
				<label for="token-input" class="block text-xs font-medium text-text-secondary">
					Authentication Bearer Token <span class="text-text-muted">(Optional for public paths)</span>
				</label>
				<button
					type="button"
					onclick={() => (showToken = !showToken)}
					class="text-[11px] text-brand hover:underline cursor-pointer"
				>
					{showToken ? 'Hide' : 'Show'}
				</button>
			</div>
			<input
				id="token-input"
				type={showToken ? 'text' : 'password'}
				bind:value={token}
				placeholder="eyJhbGciOi..."
				class="w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-xs font-mono text-text-primary focus:border-brand focus:outline-hidden"
			/>
		</div>

		{#if errorMessage}
			<div class="rounded-lg bg-status-critical/10 border border-status-critical/20 px-3 py-2 text-xs text-status-critical flex items-center justify-between">
				<span>{errorMessage}</span>
				<span class="text-[10px] uppercase font-mono">Status Error</span>
			</div>
		{/if}

		<div class="flex items-center justify-end gap-3 pt-1">
			<button
				type="button"
				onclick={handleTest}
				disabled={isTesting}
				class="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-xs font-medium text-brand-contrast hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
			>
				{#if isTesting}
					<span class="animate-spin text-xs">⟳</span>
					<span>Testing...</span>
				{:else}
					<span>Test Connection</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- Fleet Architecture & Telemetry Specs Card -->
	<div class="glass-panel rounded-2xl p-5 shadow-xs space-y-4">
		<div class="flex items-center gap-2 border-b border-border-subtle pb-3">
			<span class="text-base">⚙️</span>
			<h2 class="text-sm font-semibold text-text-primary">Storage & Architecture</h2>
		</div>

		<div class="space-y-3 text-xs">
			<div class="flex items-center justify-between">
				<span class="text-text-muted">Host Machine</span>
				<span class="font-medium font-mono text-text-primary">core-pi (10.85.48.120)</span>
			</div>

			<div class="flex items-center justify-between">
				<span class="text-text-muted">Transport</span>
				<span class="font-medium text-text-primary">NetBird Mesh + Caddy TLS</span>
			</div>

			<div class="flex items-center justify-between">
				<span class="text-text-muted">Compression</span>
				<span class="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-brand font-semibold">zstd (level 8)</span>
			</div>

			<div class="flex items-center justify-between">
				<span class="text-text-muted">NAR Threshold</span>
				<span class="font-mono text-text-secondary">1 MiB (un-chunked)</span>
			</div>

			<div class="flex items-center justify-between">
				<span class="text-text-muted">Average Chunk</span>
				<span class="font-mono text-text-secondary">4 MiB</span>
			</div>

			<div class="border-t border-border-subtle pt-3">
				<div class="text-[11px] font-medium text-text-muted mb-1.5 uppercase tracking-wider">
					Upstream Public Proxies
				</div>
				<div class="flex flex-wrap gap-1.5">
					<span class="rounded-md border border-border-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-secondary">
						cache.nixos.org-1
					</span>
					<span class="rounded-md border border-border-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-secondary">
						nix-community.cachix.org-1
					</span>
				</div>
			</div>

			<div class="border-t border-border-subtle pt-3">
				<div class="text-[11px] font-medium text-text-muted mb-1 uppercase tracking-wider">
					Retention & Reaper
				</div>
				<p class="text-[11px] text-text-secondary">
					Weekly auto-reaper on Sunday 05:30 cleans unreferenced chunks and DB compaction.
				</p>
			</div>
		</div>
	</div>
</div>
