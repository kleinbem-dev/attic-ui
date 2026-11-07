<script lang="ts">
	import StatusDot from '@kleinbem/web-config/components/StatusDot';
	import type { CacheStatus } from '#lib/types';

	let {
		status = 'healthy',
		latencyMs = null,
		onOpenCommandPalette
	}: {
		status?: CacheStatus;
		latencyMs?: number | null;
		onOpenCommandPalette?: () => void;
	} = $props();

	let currentTheme = $state('system');

	function toggleTheme() {
		const themes = ['dark', 'light', 'system'];
		const next = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
		currentTheme = next;
		localStorage.setItem('fleet-theme', next);

		const isDark =
			next === 'dark' || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
		document.documentElement.dataset.theme = next;
		document.documentElement.classList.toggle('dark', isDark);
		document.documentElement.classList.toggle('light', !isDark);
	}

	$effect(() => {
		try {
			const saved = localStorage.getItem('fleet-theme');
			if (saved) currentTheme = saved;
		} catch (e) {}
	});
</script>

<header class="sticky top-0 z-30 border-b border-border-subtle bg-bg-surface/80 backdrop-blur-md">
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<div class="flex items-center gap-3">
			<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-xl font-bold text-brand shadow-sm">
				📦
			</span>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="text-lg font-bold tracking-tight text-text-primary">Attic UI</h1>
					<span class="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand uppercase tracking-wider">
						Binary Cache
					</span>
				</div>
				<p class="text-xs text-text-muted">kleinbem fleet deduplicated Nix store</p>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<!-- Live Health Status Indicator -->
			<div class="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated/60 px-3 py-1.5 text-xs text-text-secondary shadow-xs">
				<StatusDot {status} pulse={status === 'healthy'} size="sm" />
				<span class="capitalize">{status}</span>
				{#if latencyMs !== null}
					<span class="text-text-muted">· {latencyMs}ms</span>
				{/if}
			</div>

			<!-- Search / Command Palette Trigger -->
			{#if onOpenCommandPalette}
				<button
					type="button"
					onclick={onOpenCommandPalette}
					class="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-elevated/50 px-2.5 py-1.5 text-xs text-text-muted hover:border-brand/40 hover:text-text-primary transition-colors cursor-pointer"
					aria-label="Open command palette"
				>
					<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
					<span>Search paths</span>
					<kbd class="rounded border border-border-subtle bg-bg-surface px-1.5 py-0.5 text-[10px] font-medium font-mono text-text-muted shadow-2xs">⌘K</kbd>
				</button>
			{/if}

			<!-- Theme Toggle Button -->
			<button
				type="button"
				onclick={toggleTheme}
				class="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated/50 text-text-secondary hover:border-brand/40 hover:text-text-primary transition-colors cursor-pointer"
				title="Toggle theme ({currentTheme})"
				aria-label="Toggle theme"
			>
				{#if currentTheme === 'dark'}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
					</svg>
				{:else if currentTheme === 'light'}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
					</svg>
				{:else}
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
					</svg>
				{/if}
			</button>
		</div>
	</div>
</header>
