<script lang="ts">
	import { onDestroy } from 'svelte';
	import { buildClientSnippets } from '#lib/attic-api';
	import { ClipboardFeedback } from '#lib/clipboard.svelte';

	export type ConfigTab = 'nixos' | 'nixconf' | 'cli';

	let {
		endpoint = 'https://cache.nixos.org',
		cacheName = '',
		publicKey = null,
		activeTab = $bindable<ConfigTab>('nixos')
	}: {
		endpoint?: string;
		cacheName?: string;
		publicKey?: string | null;
		activeTab?: ConfigTab;
	} = $props();

	const tabs: { id: ConfigTab; label: string }[] = [
		{ id: 'nixos', label: 'NixOS / Flake' },
		{ id: 'nixconf', label: 'nix.conf' },
		{ id: 'cli', label: 'Attic CLI' }
	];

	const clipboard = new ClipboardFeedback();
	onDestroy(() => clipboard.destroy());

	const snippets = $derived(buildClientSnippets(endpoint, cacheName, publicKey));
	const currentCode = $derived(snippets[activeTab]);

	function handleTabKeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
		const idx = tabs.findIndex((t) => t.id === activeTab);
		let next = -1;
		if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
		else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = tabs.length - 1;
		if (next < 0) return;
		e.preventDefault();
		activeTab = tabs[next].id;
		e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
	}
</script>

<section aria-labelledby="client-config-heading" class="glass-panel rounded-2xl p-5 shadow-xs space-y-4">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
		<div class="flex items-center gap-2">
			<span aria-hidden="true" class="text-base">📋</span>
			<h2 id="client-config-heading" class="text-sm font-semibold text-heading">
				Client Configuration & Quickstart
			</h2>
		</div>

		<div
			role="tablist"
			tabindex="-1"
			aria-label="Client configuration format"
			onkeydown={handleTabKeydown}
			class="flex items-center gap-1.5 flex-wrap"
		>
			{#each tabs as tab (tab.id)}
				{@const selected = activeTab === tab.id}
				<button
					type="button"
					id={`cfg-tab-${tab.id}`}
					role="tab"
					aria-selected={selected}
					tabindex={selected ? 0 : -1}
					onclick={() => (activeTab = tab.id)}
					class="text-xs font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent {selected
						? 'bg-accent/10 text-accent'
						: 'text-muted hover:text-heading'}"
				>
					{tab.label}
				</button>
			{/each}
		</div>
	</div>

	<div
		role="tabpanel"
		aria-labelledby={`cfg-tab-${activeTab}`}
		class="relative"
	>
		<button
			type="button"
			onclick={() => clipboard.copy(currentCode, 'snippet')}
			class="absolute top-3 right-3 rounded-lg border border-line bg-bg px-2.5 py-1 text-xs font-medium text-fg hover:text-heading hover:border-accent/40 transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
		>
			{#if clipboard.copiedId === 'snippet'}
				<span class="text-status-success font-bold">✓</span>
				<span>Copied!</span>
			{:else if clipboard.failedId === 'snippet'}
				<span class="text-status-danger">Copy failed</span>
			{:else}
				<svg aria-hidden="true" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
				</svg>
				<span>Copy Snippet</span>
			{/if}
		</button>
		<pre class="rounded-xl border border-line bg-bg p-4 pr-28 font-mono text-xs text-fg overflow-x-auto whitespace-pre leading-relaxed">{currentCode}</pre>
	</div>
</section>
