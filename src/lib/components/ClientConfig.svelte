<script lang="ts">
	import { isPublicNixCache } from '../attic-api';

	let {
		endpoint = 'https://attic.kleinbem.dev',
		cacheName = 'system'
	}: {
		endpoint?: string;
		cacheName?: string;
	} = $props();

	let activeConfig = $state<'nixos' | 'nixconf' | 'cli'>('nixos');
	let copied = $state(false);

	const cleanEndpoint = $derived(endpoint.replace(/\/+$/, ''));
	const isPublicNix = $derived(isPublicNixCache(cleanEndpoint));
	const isKleinbemEndpoint = $derived((() => {
		try {
			const host = new URL(cleanEndpoint).hostname;
			return host === 'kleinbem.dev' || host.endsWith('.kleinbem.dev');
		} catch {
			return false;
		}
	})());
	const cacheUrl = $derived(isPublicNix ? cleanEndpoint : `${cleanEndpoint}/${cacheName}`);

	const knownPublicKey = $derived(
		cacheName === 'system' && isKleinbemEndpoint
			? 'system:dCe+aNk1+Dwf3IG6OVBKcf5h0oL0hkRVqYiLN7iOJhU='
			: `${cacheName}:<your-attic-public-key>`
	);

	const nixosSnippet = $derived(
		isPublicNix
			? `nix.settings = {
  substituters = [
    "https://cache.nixos.org"
  ];
  trusted-public-keys = [
    "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY="
  ];
};`
			: `nix.settings = {
  substituters = [
    "https://cache.nixos.org",
    "${cacheUrl}"
  ];
  trusted-public-keys = [
    "cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=",
    "${knownPublicKey}"
  ];
};`
	);

	const nixConfSnippet = $derived(
		isPublicNix
			? `substituters = https://cache.nixos.org
trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=`
			: `substituters = https://cache.nixos.org ${cacheUrl}
trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY= ${knownPublicKey}`
	);

	const cliSnippet = $derived(
		isPublicNix
			? `# Query public NixOS cache directly via Nix CLI:
nix path-info --store https://cache.nixos.org /nix/store/...`
			: `# 1. Log in to the Attic server
attic login kleinbem ${cleanEndpoint} <your-token>

# 2. Query cache details
attic cache info ${cacheName}

# 3. Push store paths manually or from a build
attic push ${cacheName} /nix/store/...

# 4. Watch build outputs and push automatically (post-build-hook)
nix-build --post-build-hook /run/current-system/sw/bin/attic-post-build-hook`
	);

	const currentCode = $derived(
		activeConfig === 'nixos' ? nixosSnippet : activeConfig === 'nixconf' ? nixConfSnippet : cliSnippet
	);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(currentCode);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (e) {}
	}
</script>

<div class="glass-panel rounded-2xl p-5 shadow-xs space-y-4">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
		<div class="flex items-center gap-2">
			<span class="text-base">📋</span>
			<h2 class="text-sm font-semibold text-text-primary">Client Configuration & Quickstart</h2>
		</div>
		<div class="flex items-center gap-1.5">
			<button
				type="button"
				onclick={() => (activeConfig = 'nixos')}
				class="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer {activeConfig === 'nixos' ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'}"
			>
				NixOS / Flake
			</button>
			<button
				type="button"
				onclick={() => (activeConfig = 'nixconf')}
				class="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer {activeConfig === 'nixconf' ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'}"
			>
				nix.conf
			</button>
			<button
				type="button"
				onclick={() => (activeConfig = 'cli')}
				class="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer {activeConfig === 'cli' ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'}"
			>
				Attic CLI
			</button>
		</div>
	</div>

	<div class="relative">
		<button
			type="button"
			onclick={handleCopy}
			class="absolute top-3 right-3 rounded-lg border border-border-subtle bg-bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-brand/40 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
		>
			{#if copied}
				<span class="text-status-healthy font-bold">✓</span>
				<span>Copied!</span>
			{:else}
				<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
				</svg>
				<span>Copy Snippet</span>
			{/if}
		</button>
		<pre class="rounded-xl border border-border-subtle bg-bg-surface p-4 font-mono text-xs text-text-secondary overflow-x-auto whitespace-pre leading-relaxed">{currentCode}</pre>
	</div>
</div>
