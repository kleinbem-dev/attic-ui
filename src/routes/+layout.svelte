<script lang="ts">
	import '../app.css';
	import CommandPalette from '@kleinbem/web-config/components/CommandPalette';
	import type { CommandItem } from '@kleinbem/web-config/components/CommandPalette';

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
			onSelect: () => {
				localStorage.setItem('fleet-theme', 'dark');
				document.documentElement.dataset.theme = 'dark';
				document.documentElement.classList.add('dark');
				document.documentElement.classList.remove('light');
			}
		},
		{
			id: 'theme-light',
			title: 'Switch to Light Theme',
			category: 'Preferences',
			icon: '☀️',
			onSelect: () => {
				localStorage.setItem('fleet-theme', 'light');
				document.documentElement.dataset.theme = 'light';
				document.documentElement.classList.add('light');
				document.documentElement.classList.remove('dark');
			}
		},
		{
			id: 'theme-system',
			title: 'Follow System Theme',
			category: 'Preferences',
			icon: '🖥️',
			onSelect: () => {
				localStorage.setItem('fleet-theme', 'system');
				const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
				document.documentElement.dataset.theme = 'system';
				document.documentElement.classList.toggle('dark', isDark);
				document.documentElement.classList.toggle('light', !isDark);
			}
		}
	];

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
			e.preventDefault();
			commandPaletteOpen = !commandPaletteOpen;
		} else if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
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
