<script lang="ts">
	import StatusDot from '@kleinbem/web-config/components/StatusDot';
	import ThemeToggle from '@kleinbem/web-config/theme/toggle';
	import type { CacheStatus } from '#lib/types';

	let {
		status = 'unknown',
		latencyMs = null,
		subtitle = 'Nix Binary Cache & Closure Inspector',
		onOpenCommandPalette
	}: {
		status?: CacheStatus;
		latencyMs?: number | null;
		subtitle?: string;
		onOpenCommandPalette: () => void;
	} = $props();
</script>

<header class="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<div class="flex items-center gap-3 min-w-0">
			<span
				aria-hidden="true"
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-xl font-bold text-accent shadow-sm"
			>
				📦
			</span>
			<div class="min-w-0">
				<div class="flex items-center gap-2">
					<h1 class="text-lg font-bold tracking-tight text-heading">Attic UI</h1>
					<span class="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent uppercase tracking-wider">
						Binary Cache
					</span>
				</div>
				<p class="text-xs text-muted truncate">{subtitle}</p>
			</div>
		</div>

		<div class="flex items-center gap-2.5 shrink-0">
			<div class="flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1.5 text-xs text-fg shadow-xs">
				<StatusDot {status} pulse={status === 'healthy'} size="sm" />
				<span class="capitalize">{status}</span>
				{#if latencyMs !== null}
					<span class="text-muted font-mono">· {latencyMs}ms</span>
				{/if}
			</div>

			<button
				type="button"
				onclick={onOpenCommandPalette}
				class="inline-flex items-center gap-2 rounded-lg border border-line bg-surface/50 px-2.5 py-1.5 text-xs text-muted hover:border-accent/40 hover:text-heading transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				aria-label="Search paths and actions (Command K)"
			>
				<svg aria-hidden="true" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
				</svg>
				<span class="hidden sm:inline">Search paths</span>
				<kbd class="hidden sm:inline rounded border border-line bg-bg px-1.5 py-0.5 text-[10px] font-medium font-mono text-muted shadow-2xs">⌘K</kbd>
			</button>

			<ThemeToggle variant="cycle" />
		</div>
	</div>
</header>
