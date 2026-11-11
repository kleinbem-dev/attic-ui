<script lang="ts">
	import '../app.css';
	import CommandPalette from '@kleinbem/web-config/components/CommandPalette';
	import type { CommandItem } from '@kleinbem/web-config/components/CommandPalette';
	import { theme } from '@kleinbem/web-config/theme/state';

	let { children } = $props();
	let commandPaletteOpen = $state(false);

	const commandItems: CommandItem[] = [
		{
			id: 'inspect-path',
			title: 'Inspect Nix Store Path',
			category: 'Actions',
			icon: '🔍',
			onSelect: () => window.dispatchEvent(new CustomEvent('attic:focus-inspector'))
		},
		{
			id: 'test-connection',
			title: 'Test Attic Cache Connection',
			category: 'Actions',
			icon: '⚡',
			onSelect: () => window.dispatchEvent(new CustomEvent('attic:test-connection'))
		},
		{
			id: 'copy-nixos',
			title: 'Copy NixOS substituters config',
			category: 'Configuration',
			icon: '📋',
			badge: 'NixOS',
			onSelect: () => window.dispatchEvent(new CustomEvent('attic:copy-config', { detail: 'nixos' }))
		},
		{
			id: 'copy-nixconf',
			title: 'Copy nix.conf substituters',
			category: 'Configuration',
			icon: '📄',
			badge: 'nix.conf',
			onSelect: () => window.dispatchEvent(new CustomEvent('attic:copy-config', { detail: 'nixconf' }))
		},
		{
			id: 'copy-cli',
			title: 'Copy Attic CLI login command',
			category: 'Configuration',
			icon: '💻',
			badge: 'CLI',
			onSelect: () => window.dispatchEvent(new CustomEvent('attic:copy-config', { detail: 'cli' }))
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

	// One place applies the theme, so the header toggle and the palette stay in sync.
	$effect(() => {
		const active = theme.current;
		document.documentElement.dataset.theme = active;
		document.documentElement.classList.toggle('dark', active === 'dark');
		document.documentElement.classList.toggle('light', active === 'light');
	});

	function isEditable(target: EventTarget | null): boolean {
		return (
			target instanceof HTMLInputElement ||
			target instanceof HTMLTextAreaElement ||
			target instanceof HTMLSelectElement ||
			(target instanceof HTMLElement && target.isContentEditable)
		);
	}

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			commandPaletteOpen = !commandPaletteOpen;
		} else if (
			e.key === '/' &&
			!commandPaletteOpen &&
			!(e.metaKey || e.ctrlKey || e.altKey) &&
			!isEditable(e.target)
		) {
			e.preventDefault();
			commandPaletteOpen = true;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="min-h-screen bg-bg-surface text-text-primary flex flex-col">
	{@render children()}
</div>

<CommandPalette
	bind:open={commandPaletteOpen}
	items={commandItems}
	placeholder="Search paths, actions, or configuration..."
/>
