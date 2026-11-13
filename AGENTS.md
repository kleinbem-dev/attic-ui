# AGENTS.md

Guidance for AI assistants working on `attic-ui`.

## Architecture

`attic-ui` is a pure static Single-Page Application (`ssr = false`, `prerender = true` via `@sveltejs/adapter-static`) for inspecting Attic and Nix HTTP binary caches:

- `src/lib/attic-api.ts`: Pure protocol parser, URL/scheme sanitizer, origin-isolated token storage (`attic-tokens`), snippet generator, and optional `./config.json` loader. Keep free of Svelte runtime imports so `node --test` runs directly against `.ts` sources.
- `src/lib/clipboard.svelte.ts`: Shared Svelte 5 rune helper for clipboard copy feedback and timer cleanup.
- `src/lib/components/`: Presentational Svelte 5 components (`Header`, `CacheTelemetry`, `NarinfoInspector`, `ClientConfig`) using explicit callback props and zero `$effect` state loops.
- `src/routes/+page.svelte`: Top-level state coordinator with `AbortController` request cancellation and `CommandPalette` actions.
- `package.nix`: Upstream-ready `nixpkgs` derivation (`pkgs/by-name/at/attic-ui/package.nix`) installing static SPA files directly to `$out/`.

## Invariants

- **Fleet-agnostic defaults**: Never hardcode private IPs, internal hostnames, or signing keys in `src/`. Operator-specific defaults belong in runtime `./config.json`.
- **Token & URL safety**: Bearer tokens must never be sent over non-loopback `http://` or carried across origins when `endpoint` changes. All generated `href` URLs must pass `http:` / `https:` allowlisting.
- **Nix purity**: Keep `package.nix` free of IFD (`importNpmLock`) and eval-time `fetchGit`. Update `npmDepsHash` with `prefetch-npm-deps package-lock.json` whenever dependencies change.

## Verification

```bash
just test           # Unit, security, and mock HTTP integration suite (node --test)
just check          # svelte-kit sync && svelte-check (0 errors, 0 warnings)
just build          # Production static bundle
nix flake check     # Full sandboxed build + tests + smoke check + nixfmt/deadnix/statix
```
