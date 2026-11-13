# Attic UI

Web interface and closure inspector for [Attic](https://github.com/zhaofengli/attic) and standard Nix HTTP binary caches.

Built as a zero-SSR static SPA with SvelteKit, Svelte 5 Runes, Tailwind CSS 4, and [`@kleinbem/web-config`](https://github.com/kleinbem/web-config).

## Features

- **Live Cache Telemetry**: Queries `/nix-cache-info` with latency measurement, `StoreDir` / `Priority` / `WantMassQuery` inspection, and private-cache bearer-token authentication.
- **Closure & `.narinfo` Inspector**: Parses `.narinfo` metadata (`StorePath`, `NarHash`, `FileHash`, compression ratio, `Deriver`, `References`, cryptographic `Sig` entries, `CA`), supports interactive reference traversal with breadcrumb history, and falls back to `cache.nixos.org` for upstream paths when configured.
- **Origin-Scoped Token Safety**: Withholds bearer tokens over non-loopback plain HTTP, scopes saved tokens strictly per endpoint origin, and rejects non-HTTP(S) URL schemes.
- **Client Setup Snippets**: Generates copy-ready `NixOS` / flake configuration, `nix.conf` settings, and `attic` CLI commands.
- **Command Palette (`⌘K` / `/`)**: Keyboard-first navigation across path search, cache presets, snippet copying, and theme switching.
- **Runtime Operator Config (`./config.json`)**: Fleet-agnostic out of the box (auto-detects hosting origin or defaults to `https://cache.nixos.org` on `localhost`), with optional zero-rebuild customization via `./config.json`.

## Runtime Configuration (`config.json`)

Serve an optional `config.json` alongside the static root (`$out/`) to customize defaults without rebuilding:

```json
{
  "subtitle": "Production Nix Binary Cache",
  "footer": "Example Infrastructure",
  "defaultEndpoint": "https://attic.example.org",
  "defaultCache": "main",
  "upstreamFallback": true,
  "publicKeys": {
    "main": "main:base64-ed25519-public-key="
  },
  "presets": [
    { "label": "attic.example.org", "endpoint": "https://attic.example.org", "cacheName": "main" },
    { "label": "cache.nixos.org", "endpoint": "https://cache.nixos.org", "cacheName": "" }
  ],
  "samples": [
    { "name": "hello-2.12.3", "hash": "sd779x86bjaqxj2lzh2jsir4h0zjz6d1", "group": "Samples" }
  ],
  "specs": {
    "Chunking": "FastCDC deduplicated NARs"
  }
}
```

## Development & Nix Packaging

```bash
just dev            # Start Vite dev server (proxies /proxy-cache -> ATTIC_PROXY_TARGET)
just test           # Run Node unit & loopback HTTP integration tests
just check          # Run svelte-kit sync and svelte-check
just build          # Build static SPA into build/
nix flake check     # Sandboxed build, tests, typecheck, smoke test, and Nix linters
```

`package.nix` follows `NixOS/nixpkgs` RFC 0140 (`pkgs/by-name/at/attic-ui/package.nix`) and RFC 0166 (`nixfmt`) conventions with pure `fetchNpmDeps`, `strictDeps = true`, `__structuredAttrs = true`, and `allowedReferences = [ ]`.

## License

[MIT](./LICENSE)
