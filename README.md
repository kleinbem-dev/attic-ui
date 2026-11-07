# Attic UI

Next-generation web interface and store inspector for [Attic](https://github.com/zhaofengli/attic), the multi-tenant Nix binary cache server powering the `kleinbem` fleet.

Styled with [`@kleinbem/web-config`](https://github.com/kleinbem/web-config), Svelte 5 runes, and Tailwind CSS 4.

## Features

- **Live Cache Health & Metrics**: Connects to Attic binary cache endpoints with live ping, auth status, and health indicators (`<StatusDot />`).
- **Nix Store Inspector**: Look up any Nix store path or NAR hash to view its parsed `.narinfo` details (compression, NAR size, references, derivers, and signature keys).
- **Client Configuration Helper**: 1-click copyable snippets for `nix.conf`, NixOS flake configuration (`substituters`, `trusted-public-keys`), and `attic` CLI token commands.
- **Command Palette (`⌘K` / `/`)**: Rapid navigation across inspector tools and settings.
- **Pure Static SPA**: Builds with zero runtime dependencies via Nix (`buildNpmPackage`), ready for Caddy or static hosting.

## Development

```bash
npm install
npm run dev
npm run check
npm run build
```
