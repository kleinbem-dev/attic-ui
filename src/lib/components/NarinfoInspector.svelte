<script lang="ts">
	import { formatBytes, extractStoreHash } from '../attic-api';
	import type { NarInfo } from '../types';

	let {
		narInfo = null,
		isLoading = false,
		error = '',
		source = '',
		onSearch
	}: {
		narInfo?: NarInfo | null;
		isLoading?: boolean;
		error?: string;
		source?: string;
		onSearch: (hashOrPath: string) => void;
	} = $props();

	let inputVal = $state('');
	let activeTab = $state<'parsed' | 'raw'>('parsed');
	let copiedPath = $state(false);
	let copiedRaw = $state(false);

	const samplePackages = [
		{
			name: 'jq-1.8.2',
			hash: '9l0j15jg8634hkb6d4c9y95mpxl0nhrd'
		},
		{
			name: 'curl-8.22.0',
			hash: '5lpg7j8y8lf8c4zv318yi4rmgyn5yhip'
		},
		{
			name: 'glibc-2.44',
			hash: 'pqyiidz5mi73wv5f91d48s9plcqyj5bz'
		}
	];

	function selectSample(hash: string) {
		inputVal = hash;
		onSearch(hash);
	}

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		if (!inputVal.trim()) return;
		onSearch(inputVal.trim());
	}

	function handleInspectReference(ref: string) {
		inputVal = ref;
		onSearch(ref);
	}

	async function copyToClipboard(text: string, type: 'path' | 'raw') {
		try {
			await navigator.clipboard.writeText(text);
			if (type === 'path') {
				copiedPath = true;
				setTimeout(() => (copiedPath = false), 2000);
			} else {
				copiedRaw = true;
				setTimeout(() => (copiedRaw = false), 2000);
			}
		} catch (e) {}
	}
</script>

<div class="glass-panel rounded-2xl p-5 shadow-xs space-y-5">
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
		<div class="flex items-center gap-2">
			<span class="text-base">🔍</span>
			<h2 class="text-sm font-semibold text-text-primary">Nix Store Path & Closure Inspector</h2>
		</div>
		<div class="text-xs text-text-muted">
			Inspect closure NAR metadata, dependencies, and signatures
		</div>
	</div>

	<!-- Search Input Bar -->
	<form onsubmit={handleSubmit} class="flex flex-col sm:flex-row gap-2">
		<div class="relative flex-1">
			<input
				type="text"
				bind:value={inputVal}
				placeholder="Enter /nix/store/... path or 32-character hash"
				class="w-full rounded-lg border border-border-subtle bg-bg-surface px-3.5 py-2.5 text-xs font-mono text-text-primary focus:border-brand focus:outline-hidden pr-8"
			/>
			{#if inputVal}
				<button
					type="button"
					onclick={() => (inputVal = '')}
					class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
					aria-label="Clear input"
				>
					✕
				</button>
			{/if}
		</div>
		<button
			type="submit"
			disabled={isLoading || !inputVal.trim()}
			class="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-medium text-brand-contrast hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer whitespace-nowrap"
		>
			{#if isLoading}
				<span class="animate-spin text-xs">⟳</span>
				<span>Querying...</span>
			{:else}
				<span>Inspect Path</span>
			{/if}
		</button>
	</form>

	<!-- Sample Chips -->
	<div class="flex flex-wrap items-center gap-2 text-xs">
		<span class="text-text-muted">Sample closures:</span>
		{#each samplePackages as sample}
			<button
				type="button"
				disabled={isLoading}
				onclick={() => selectSample(sample.hash)}
				class="rounded-md border border-border-subtle bg-bg-surface px-2.5 py-1 text-[11px] font-mono text-text-secondary hover:text-brand hover:border-brand/40 disabled:opacity-50 transition-colors cursor-pointer"
			>
				{sample.name}
			</button>
		{/each}
	</div>

	<!-- Error Message Display -->
	{#if error}
		<div class="rounded-lg bg-status-critical/10 border border-status-critical/20 p-3 text-xs text-status-critical flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span>⚠️</span>
				<span>{error}</span>
			</div>
			<span class="text-[11px] font-mono text-text-muted">Check cache token or path hash</span>
		</div>
	{/if}

	<!-- Results Panel -->
	{#if narInfo}
		<div class="space-y-4 pt-1">
			<div class="flex items-center justify-between border-b border-border-subtle pb-2">
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (activeTab = 'parsed')}
						class="text-xs font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer {activeTab === 'parsed' ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'}"
					>
						Parsed Details
					</button>
					<button
						type="button"
						onclick={() => (activeTab = 'raw')}
						class="text-xs font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer {activeTab === 'raw' ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'}"
					>
						Raw .narinfo
					</button>
					{#if source}
						<span class="rounded bg-brand/10 border border-brand/20 px-2 py-0.5 text-[10px] font-mono text-brand font-medium">
							{source}
						</span>
					{/if}
				</div>
				<button
					type="button"
					onclick={() => copyToClipboard(narInfo.storePath, 'path')}
					class="text-[11px] text-text-muted hover:text-text-primary flex items-center gap-1 cursor-pointer font-mono"
				>
					<span>{copiedPath ? '✓ Copied' : 'Copy Store Path'}</span>
				</button>
			</div>

			{#if activeTab === 'parsed'}
				<div class="space-y-4 text-xs">
					<!-- Store Path Header Card -->
					<div class="rounded-xl border border-border-subtle bg-bg-surface p-3.5 space-y-2">
						<div class="text-[11px] uppercase tracking-wider font-medium text-text-muted">
							Store Path
						</div>
						<div class="font-mono text-xs text-text-primary break-all select-all font-semibold">
							{narInfo.storePath}
						</div>
					</div>

					<!-- Metrics Grid -->
					<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
						<div class="rounded-xl border border-border-subtle bg-bg-surface p-3">
							<div class="text-[11px] text-text-muted mb-1">Uncompressed NAR</div>
							<div class="text-sm font-semibold font-mono text-text-primary">
								{formatBytes(narInfo.narSize)}
							</div>
						</div>

						<div class="rounded-xl border border-border-subtle bg-bg-surface p-3">
							<div class="text-[11px] text-text-muted mb-1">Compressed File</div>
							<div class="text-sm font-semibold font-mono text-text-primary">
								{formatBytes(narInfo.fileSize)}
							</div>
						</div>

						<div class="rounded-xl border border-border-subtle bg-bg-surface p-3">
							<div class="text-[11px] text-text-muted mb-1">Compression</div>
							<div class="flex items-center gap-1.5">
								<span class="rounded bg-brand/10 px-1.5 py-0.5 font-mono text-xs text-brand font-semibold">
									{narInfo.compression}
								</span>
								{#if narInfo.narSize > 0 && narInfo.fileSize > 0}
									<span class="text-[10px] text-text-muted">
										({Math.round((narInfo.fileSize / narInfo.narSize) * 100)}%)
									</span>
								{/if}
							</div>
						</div>

						<div class="rounded-xl border border-border-subtle bg-bg-surface p-3">
							<div class="text-[11px] text-text-muted mb-1">References</div>
							<div class="text-sm font-semibold font-mono text-text-primary">
								{narInfo.references.length} closure deps
							</div>
						</div>
					</div>

					<!-- Hashes & Deriver -->
					<div class="rounded-xl border border-border-subtle bg-bg-surface p-3.5 space-y-2.5 font-mono text-[11px]">
						<div>
							<span class="text-text-muted block text-[10px] uppercase tracking-wider font-sans">NarHash</span>
							<span class="text-text-secondary break-all">{narInfo.narHash || '—'}</span>
						</div>
						<div>
							<span class="text-text-muted block text-[10px] uppercase tracking-wider font-sans">FileHash</span>
							<span class="text-text-secondary break-all">{narInfo.fileHash || '—'}</span>
						</div>
						{#if narInfo.deriver}
							<div>
								<span class="text-text-muted block text-[10px] uppercase tracking-wider font-sans">Deriver (.drv)</span>
								<span class="text-brand break-all">/nix/store/{narInfo.deriver}</span>
							</div>
						{/if}
						{#if narInfo.sig && narInfo.sig.length > 0}
							<div>
								<span class="text-text-muted block text-[10px] uppercase tracking-wider font-sans">Signatures</span>
								{#each narInfo.sig as s}
									<div class="text-text-secondary break-all">{s}</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- References List -->
					{#if narInfo.references.length > 0}
						<div class="space-y-2">
							<div class="flex items-center justify-between text-xs font-semibold text-text-primary">
								<span>Closure References ({narInfo.references.length})</span>
								<span class="text-[10px] font-normal text-text-muted">Click any dependency to inspect</span>
							</div>
							<div class="max-h-48 overflow-y-auto rounded-xl border border-border-subtle bg-bg-surface p-2 divide-y divide-border-subtle font-mono text-[11px]">
								{#each narInfo.references as ref}
									<button
										type="button"
										onclick={() => handleInspectReference(ref)}
										class="w-full text-left py-1.5 px-2 hover:bg-bg-elevated text-text-secondary hover:text-brand transition-colors rounded cursor-pointer truncate block"
										title="Inspect /nix/store/{ref}"
									>
										/nix/store/{ref}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Raw .narinfo View -->
				<div class="relative">
					<button
						type="button"
						onclick={() => copyToClipboard(narInfo.raw, 'raw')}
						class="absolute top-2.5 right-2.5 rounded bg-bg-surface/80 px-2 py-1 text-[10px] font-mono text-text-secondary hover:text-text-primary border border-border-subtle cursor-pointer"
					>
						{copiedRaw ? '✓ Copied' : 'Copy'}
					</button>
					<pre class="rounded-xl border border-border-subtle bg-bg-surface p-4 font-mono text-xs text-text-secondary overflow-x-auto whitespace-pre leading-relaxed">{narInfo.raw}</pre>
				</div>
			{/if}
		</div>
	{:else if !isLoading}
		<div class="rounded-xl border border-dashed border-border-subtle p-8 text-center text-xs text-text-muted space-y-3">
			<div class="text-2xl">📦</div>
			<div class="font-medium text-text-primary">No path selected</div>
			<p class="max-w-md mx-auto text-text-muted">
				Enter a Nix store path or hash above to query Attic's binary cache and inspect its closure metadata, references, and compression.
			</p>
			<div class="pt-2 flex flex-wrap justify-center items-center gap-2">
				<span class="text-text-muted">Or try a sample package:</span>
				{#each samplePackages as sample}
					<button
						type="button"
						disabled={isLoading}
						onclick={() => selectSample(sample.hash)}
						class="rounded-lg border border-border-subtle bg-bg-surface px-3 py-1.5 text-xs font-mono text-text-secondary hover:text-brand hover:border-brand/50 disabled:opacity-50 transition-colors cursor-pointer"
					>
						⚡ {sample.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
