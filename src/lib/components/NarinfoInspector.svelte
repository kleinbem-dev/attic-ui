<script lang="ts">
	import { onDestroy } from 'svelte';
	import { formatBytes, getNarDownloadUrl, getNarinfoUrl } from '#lib/attic-api';
	import { ClipboardFeedback } from '#lib/clipboard.svelte';
	import type { BreadcrumbItem, NarInfo, SamplePath } from '#lib/types';

	let {
		narInfo = null,
		isLoading = false,
		error = '',
		source = '',
		endpoint = '',
		cacheName = '',
		storeDir = '/nix/store',
		samples = [],
		historyTrail = [],
		onSearch
	}: {
		narInfo?: NarInfo | null;
		isLoading?: boolean;
		error?: string;
		source?: string;
		endpoint?: string;
		cacheName?: string;
		storeDir?: string;
		samples?: SamplePath[];
		historyTrail?: BreadcrumbItem[];
		onSearch: (hashOrPath: string) => void;
	} = $props();

	let inputVal = $state('');
	let searchInputEl = $state<HTMLInputElement | null>(null);
	let activeTab = $state<'parsed' | 'raw'>('parsed');

	const clipboard = new ClipboardFeedback();
	onDestroy(() => clipboard.destroy());

	export function focusSearch(): void {
		searchInputEl?.focus();
		searchInputEl?.select();
	}

	const narinfoUrl = $derived(
		narInfo ? getNarinfoUrl(endpoint, cacheName, narInfo.storePath) : ''
	);
	const narDownloadUrl = $derived(
		narInfo?.url ? getNarDownloadUrl(endpoint, cacheName, narInfo.url) : ''
	);

	const groupedSamples = $derived.by(() => {
		const groups = new Map<string, SamplePath[]>();
		for (const sample of samples) {
			const group = sample.group || 'Samples';
			const list = groups.get(group);
			if (list) list.push(sample);
			else groups.set(group, [sample]);
		}
		return Array.from(groups.entries());
	});

	function formatStoreEntry(entry: string): string {
		const cleanStore = storeDir.replace(/\/+$/, '') || '/nix/store';
		return entry.startsWith('/') ? entry : `${cleanStore}/${entry}`;
	}

	function selectHash(hashOrRef: string) {
		inputVal = hashOrRef;
		onSearch(hashOrRef);
	}

	function goBack() {
		if (historyTrail.length > 1) {
			selectHash(historyTrail[historyTrail.length - 2].hash);
		}
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = inputVal.trim();
		if (!trimmed) return;
		onSearch(trimmed);
	}

	const detailTabs: { id: 'parsed' | 'raw'; label: string }[] = [
		{ id: 'parsed', label: 'Parsed Details' },
		{ id: 'raw', label: 'Raw .narinfo' }
	];

	function handleTabKeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
		const idx = detailTabs.findIndex((t) => t.id === activeTab);
		let next = -1;
		if (e.key === 'ArrowRight') next = (idx + 1) % detailTabs.length;
		else if (e.key === 'ArrowLeft') next = (idx - 1 + detailTabs.length) % detailTabs.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = detailTabs.length - 1;
		if (next < 0) return;
		e.preventDefault();
		activeTab = detailTabs[next].id;
		e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
	}
</script>

<section aria-labelledby="inspector-heading" class="glass-panel rounded-2xl p-5 shadow-xs space-y-5">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
		<div class="flex items-center gap-2">
			<span aria-hidden="true" class="text-base">🔍</span>
			<h2 id="inspector-heading" class="text-sm font-semibold text-heading">
				Nix Store Path & Closure Inspector
			</h2>
		</div>
		<div class="text-xs text-muted">
			Inspect closure NAR metadata, dependencies, and signatures
		</div>
	</div>

	<form onsubmit={handleSubmit} class="flex flex-col sm:flex-row gap-2">
		<div class="relative flex-1">
			<label for="store-path-input" class="sr-only">
				Nix store path or 32-character hash
			</label>
			<input
				id="store-path-input"
				bind:this={searchInputEl}
				type="text"
				bind:value={inputVal}
				spellcheck="false"
				placeholder="Enter /nix/store/... path or 32-character hash"
				class="w-full rounded-lg border border-line bg-bg px-3.5 py-2.5 pr-8 text-xs font-mono text-heading focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
			/>
			{#if inputVal}
				<button
					type="button"
					onclick={() => {
						inputVal = '';
						searchInputEl?.focus();
					}}
					class="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-muted hover:text-heading text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
					aria-label="Clear search input"
				>
					✕
				</button>
			{/if}
		</div>
		<button
			type="submit"
			disabled={isLoading || !inputVal.trim()}
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-medium text-accent-fg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
		>
			{#if isLoading}
				<span aria-hidden="true" class="animate-spin text-xs">⟳</span>
				<span>Querying...</span>
			{:else}
				<span>Inspect Path</span>
			{/if}
		</button>
	</form>

	{#if groupedSamples.length > 0}
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
			{#each groupedSamples as [group, items] (group)}
				<div class="flex items-center gap-1.5 flex-wrap">
					<span class="text-muted font-medium">{group}:</span>
					{#each items as sample (sample.hash)}
						<button
							type="button"
							disabled={isLoading}
							onclick={() => selectHash(sample.hash)}
							class="rounded-md border border-line bg-bg px-2 py-0.5 text-[11px] font-mono text-fg hover:text-accent hover:border-accent/40 disabled:opacity-50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
							title={sample.description ? `${sample.name} — ${sample.description}` : sample.name}
						>
							{sample.name}
						</button>
					{/each}
				</div>
			{/each}
		</div>
	{/if}

	{#if historyTrail.length > 1}
		<nav aria-label="Inspected closure trail" class="flex items-center gap-1.5 text-xs text-muted overflow-x-auto py-1 border-t border-line/50 pt-2.5">
			<button
				type="button"
				onclick={goBack}
				class="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-line bg-bg hover:text-accent hover:border-accent/40 text-[11px] font-mono cursor-pointer shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
			>
				← Back
			</button>
			<span class="text-muted/60 text-[10px] shrink-0 font-medium uppercase tracking-wider">Trail:</span>
			<div class="flex items-center gap-1 overflow-x-auto">
				{#each historyTrail as item, i (item.hash)}
					{#if i > 0}
						<span aria-hidden="true" class="text-muted/40 shrink-0">/</span>
					{/if}
					<button
						type="button"
						aria-current={i === historyTrail.length - 1 ? 'step' : undefined}
						onclick={() => selectHash(item.hash)}
						class="truncate max-w-[150px] px-1.5 py-0.5 rounded transition-colors text-[11px] font-mono cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent {i === historyTrail.length - 1
							? 'font-semibold text-accent bg-accent/10 border border-accent/20'
							: 'text-fg hover:text-heading hover:bg-surface'}"
						title={`${item.label} (${item.hash})`}
					>
						{item.label}
					</button>
				{/each}
			</div>
		</nav>
	{/if}

	{#if error}
		<div
			role="alert"
			class="rounded-lg bg-status-danger/10 border border-status-danger/20 p-3 text-xs text-status-danger flex items-center justify-between gap-2"
		>
			<div class="flex items-center gap-2">
				<span aria-hidden="true">⚠️</span>
				<span>{error}</span>
			</div>
			<span class="text-[11px] font-mono text-muted shrink-0">Verify token or store hash</span>
		</div>
	{/if}

	{#if narInfo}
		<div class="space-y-4 pt-1">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-2">
				<div class="flex items-center gap-2 flex-wrap">
					<div
						role="tablist"
						tabindex="-1"
						aria-label="Narinfo view mode"
						onkeydown={handleTabKeydown}
						class="flex items-center gap-1"
					>
						{#each detailTabs as tab (tab.id)}
							{@const selected = activeTab === tab.id}
							<button
								type="button"
								id={`nar-tab-${tab.id}`}
								role="tab"
								aria-selected={selected}
								tabindex={selected ? 0 : -1}
								onclick={() => (activeTab = tab.id)}
								class="text-xs font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent {selected
									? 'bg-accent/10 text-accent'
									: 'text-muted hover:text-heading'}"
							>
								{tab.label}
							</button>
						{/each}
					</div>
					{#if source}
						<span class="rounded bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] font-mono text-accent font-medium">
							{source}
						</span>
					{/if}
				</div>

				<div class="flex items-center gap-3 text-[11px] font-mono flex-wrap">
					{#if narinfoUrl}
						<a
							href={narinfoUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted hover:text-accent flex items-center gap-1 transition-colors rounded px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
						>
							<span>View .narinfo ↗</span>
						</a>
					{/if}
					{#if narDownloadUrl}
						<a
							href={narDownloadUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-muted hover:text-accent flex items-center gap-1 transition-colors rounded px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
						>
							<span>Download NAR ⤓</span>
						</a>
					{/if}
					<button
						type="button"
						onclick={() => clipboard.copy(narInfo.storePath, 'path')}
						class="text-muted hover:text-heading flex items-center gap-1 cursor-pointer transition-colors rounded px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
					>
						<span>
							{clipboard.copiedId === 'path'
								? '✓ Copied'
								: clipboard.failedId === 'path'
									? 'Copy failed'
									: 'Copy Store Path'}
						</span>
					</button>
				</div>
			</div>

			{#if activeTab === 'parsed'}
				<div role="tabpanel" aria-labelledby="nar-tab-parsed" class="space-y-4 text-xs">
					<div class="rounded-xl border border-line bg-bg p-3.5 space-y-2">
						<div class="text-[11px] uppercase tracking-wider font-medium text-muted">
							Store Path
						</div>
						<div class="font-mono text-xs text-heading break-all select-all font-semibold">
							{narInfo.storePath}
						</div>
					</div>

					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<div class="rounded-xl border border-line bg-bg p-3">
							<div class="text-[11px] text-muted mb-1">Uncompressed NAR</div>
							<div class="text-sm font-semibold font-mono text-heading">
								{formatBytes(narInfo.narSize)}
							</div>
						</div>

						<div class="rounded-xl border border-line bg-bg p-3">
							<div class="text-[11px] text-muted mb-1">Compressed File</div>
							<div class="text-sm font-semibold font-mono text-heading">
								{formatBytes(narInfo.fileSize)}
							</div>
						</div>

						<div class="rounded-xl border border-line bg-bg p-3">
							<div class="text-[11px] text-muted mb-1">Compression</div>
							<div class="flex items-center gap-1.5">
								<span class="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-xs text-accent font-semibold">
									{narInfo.compression}
								</span>
								{#if narInfo.narSize > 0 && narInfo.fileSize > 0}
									<span class="text-[10px] text-muted">
										({Math.round((narInfo.fileSize / narInfo.narSize) * 100)}%)
									</span>
								{/if}
							</div>
						</div>

						<div class="rounded-xl border border-line bg-bg p-3">
							<div class="text-[11px] text-muted mb-1">References</div>
							<div class="text-sm font-semibold font-mono text-heading">
								{narInfo.references.length} closure deps
							</div>
						</div>
					</div>

					<div class="rounded-xl border border-line bg-bg p-3.5 space-y-2.5 font-mono text-[11px]">
						<div>
							<span class="text-muted block text-[10px] uppercase tracking-wider font-sans">NarHash</span>
							<span class="text-fg break-all">{narInfo.narHash || '—'}</span>
						</div>
						<div>
							<span class="text-muted block text-[10px] uppercase tracking-wider font-sans">FileHash</span>
							<span class="text-fg break-all">{narInfo.fileHash || '—'}</span>
						</div>
						{#if narInfo.ca}
							<div>
								<span class="text-muted block text-[10px] uppercase tracking-wider font-sans">Content Address (CA)</span>
								<span class="text-fg break-all">{narInfo.ca}</span>
							</div>
						{/if}
						{#if narInfo.deriver}
							<div>
								<span class="text-muted block text-[10px] uppercase tracking-wider font-sans">Deriver (.drv)</span>
								<span class="text-accent break-all">{formatStoreEntry(narInfo.deriver)}</span>
							</div>
						{/if}
						{#if narInfo.sig && narInfo.sig.length > 0}
							<div>
								<span class="text-muted block text-[10px] uppercase tracking-wider font-sans">Signatures</span>
								{#each narInfo.sig as sig (sig)}
									<div class="text-fg break-all">{sig}</div>
								{/each}
							</div>
						{/if}
					</div>

					{#if narInfo.references.length > 0}
						<div class="space-y-2">
							<div class="flex items-center justify-between text-xs font-semibold text-heading">
								<span>Closure References ({narInfo.references.length})</span>
								<span class="text-[10px] font-normal text-muted">Select any dependency to inspect</span>
							</div>
							<div class="max-h-48 overflow-y-auto rounded-xl border border-line bg-bg p-2 divide-y divide-line font-mono text-[11px]">
								{#each narInfo.references as ref (ref)}
									{@const fullRef = formatStoreEntry(ref)}
									<button
										type="button"
										onclick={() => selectHash(fullRef)}
										class="w-full text-left py-1.5 px-2 hover:bg-surface text-fg hover:text-accent transition-colors rounded cursor-pointer truncate block focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
										title={`Inspect ${fullRef}`}
									>
										{fullRef}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<div role="tabpanel" aria-labelledby="nar-tab-raw" class="relative">
					<button
						type="button"
						onclick={() => clipboard.copy(narInfo.raw, 'raw')}
						class="absolute top-2.5 right-2.5 rounded bg-bg/90 px-2 py-1 text-[10px] font-mono text-fg hover:text-heading border border-line cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
					>
						{clipboard.copiedId === 'raw'
							? '✓ Copied'
							: clipboard.failedId === 'raw'
								? 'Copy failed'
								: 'Copy'}
					</button>
					<pre class="rounded-xl border border-line bg-bg p-4 pr-16 font-mono text-xs text-fg overflow-x-auto whitespace-pre leading-relaxed">{narInfo.raw}</pre>
				</div>
			{/if}
		</div>
	{:else if !isLoading}
		<div class="rounded-xl border border-dashed border-line p-8 text-center text-xs text-muted space-y-3">
			<div aria-hidden="true" class="text-2xl">📦</div>
			<div class="font-medium text-heading">No path selected</div>
			<p class="max-w-md mx-auto text-muted">
				Enter a Nix store path or 32-character hash above to query the binary cache and inspect its closure metadata, references, and signatures.
			</p>
		</div>
	{/if}
</section>
