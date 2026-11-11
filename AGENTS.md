# AGENTS.md

Guidance for AI assistants working on Attic UI.

## What Attic UI is

Attic UI is the lightweight, next-generation web interface and store inspector for Attic, the multi-tenant Nix binary cache server powering the kleinbem fleet.
It replaces the plain text/ASCII welcome screen with a modern, high-tech SvelteKit application styled with `@kleinbem/web-config` and Tailwind CSS 4.

## Key Capabilities

- **Fleet Design System**: Uses `@kleinbem/web-config` themes (dark/light, system preference, zero-FOUC).
- **Live Cache Health & Metrics**: Displays live status of Attic instances (public endpoint, NetBird mesh, or local host) via `<StatusDot />`.
- **Nix Store Inspector**: Queries and parses `.narinfo` records, visualizing store path dependencies, derivers, NAR sizes, and cryptographic signatures.
- **Client Configuration Assistant**: One-click copy for `nix.conf` (`substituters`, `trusted-public-keys`) and `attic` CLI authentication.
- **Command Palette (`⌘K` / `/`)**: Fast keyboard-driven navigation across caches, inspector, and actions.
- **Zero Runtime Overhead**: Packaged via Nix (`buildNpmPackage`) as a pure static SPA served directly by Caddy or static file hosts.

## Development

```bash
just dev      # Run Vite dev server
just check    # Run svelte-check and TypeScript checks
just build    # Build static production assets
just preview  # Preview production build
```
