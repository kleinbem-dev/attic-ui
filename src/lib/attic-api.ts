import type {
	BreadcrumbItem,
	CacheInfo,
	CachePreset,
	NarInfo,
	RuntimeConfig,
	SamplePath
} from './types';

export const PUBLIC_NIXOS_CACHE = 'https://cache.nixos.org';
export const PUBLIC_NIXOS_KEY =
	'cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=';

// Leaf packages outside stdenv/fetchFromGitHub/nodejs so Nix FOD and allowedReferences = [] stay clean.
export const DEFAULT_UPSTREAM_SAMPLES: SamplePath[] = [
	{ name: 'hello-2.12.3', hash: 'sd779x86bjaqxj2lzh2jsir4h0zjz6d1', group: 'Upstream' },
	{ name: 'ripgrep-15.2.0', hash: 'whbrk657qmih065xal60m4khwf6cb9pj', group: 'Upstream' },
	{ name: 'fd-10.5.1', hash: 'p7m1rnj0fm1nm9hwwj9vrgy3fc7grgg2', group: 'Upstream' }
];

const WITHHELD_MSG = 'Token not sent over plain HTTP: use an https:// endpoint';
const HTML_PREFIX_RE = /^\s*<(!doctype|html)\b/i;
const NIX_HASH_RE = /^[0-9a-df-np-sv-z]{32}$/i;

function parseUint(raw: string | undefined, fallback = 0): number {
	return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : fallback;
}

function defaultBaseOrigin(): string | undefined {
	return typeof window !== 'undefined' && window.location?.origin
		? window.location.origin
		: undefined;
}

/**
 * Parses an endpoint URL, allowing only http:, https:, or same-origin relative paths (/...).
 * Rejects protocol-relative (//...) and non-HTTP schemes (javascript:, data:, etc.).
 */
export function parseEndpointUrl(endpoint: string, baseOrigin = defaultBaseOrigin()): URL | null {
	const trimmed = endpoint.trim();
	if (!trimmed || trimmed.startsWith('//')) return null;

	try {
		const parsed = trimmed.startsWith('/')
			? baseOrigin
				? new URL(trimmed, baseOrigin)
				: null
			: new URL(trimmed);
		if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

export function isLoopbackHost(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function endpointOrigin(endpoint: string, baseOrigin = defaultBaseOrigin()): string {
	return parseEndpointUrl(endpoint, baseOrigin)?.origin ?? '';
}

/**
 * Normalizes a valid HTTP(S) or relative endpoint URL, stripping trailing slashes.
 * Returns '' if the endpoint is empty or uses a disallowed scheme.
 */
export function resolveEndpoint(endpoint: string, baseOrigin = defaultBaseOrigin()): string {
	const trimmed = endpoint.trim();
	const parsed = parseEndpointUrl(trimmed, baseOrigin);
	if (!parsed) return '';
	const canonical = trimmed.startsWith('/') ? trimmed : parsed.href;
	return canonical.replace(/\/+$/, '');
}

/**
 * Returns true when the endpoint points to the official public NixOS binary cache.
 */
export function isPublicNixCache(endpoint: string): boolean {
	return parseEndpointUrl(endpoint)?.hostname === 'cache.nixos.org';
}

function buildCacheBaseUrl(endpoint: string, cacheName: string): string {
	const base = resolveEndpoint(endpoint);
	if (!base) return '';
	const trimmedCache = cacheName.trim();
	if (!trimmedCache || isPublicNixCache(endpoint)) {
		return base;
	}
	return `${base}/${encodeURIComponent(trimmedCache)}`;
}

/**
 * Parses raw Nix nix-cache-info text. Returns null on HTML fallbacks or unrecognized bodies.
 */
export function parseCacheInfo(raw: string): CacheInfo | null {
	if (!raw || HTML_PREFIX_RE.test(raw)) return null;

	const info: CacheInfo = {
		storeDir: '/nix/store',
		wantMassQuery: 0,
		priority: 40
	};
	let recognized = false;

	for (const line of raw.split(/\r?\n/)) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const val = line.slice(colonIdx + 1).trim();
		if (key === 'StoreDir' && val.startsWith('/')) {
			info.storeDir = val;
			recognized = true;
		} else if (key === 'WantMassQuery' && /^\d+$/.test(val)) {
			info.wantMassQuery = Number(val);
			recognized = true;
		} else if (key === 'Priority' && /^\d+$/.test(val)) {
			info.priority = Number(val);
			recognized = true;
		}
	}

	return recognized ? info : null;
}

/**
 * Parses raw Nix .narinfo format into a structured NarInfo object.
 */
export function parseNarInfo(raw: string): NarInfo {
	const map: Record<string, string> = {};
	const sigs: string[] = [];

	for (const line of raw.trim().split(/\r?\n/)) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const val = line.slice(colonIdx + 1).trim();

		if (key === 'Sig') {
			if (val) sigs.push(val);
		} else {
			map[key] = val;
		}
	}

	const deriver = map['Deriver'];
	return {
		storePath: map['StorePath'] || '',
		url: map['URL'] || '',
		compression: map['Compression'] || 'none',
		fileHash: map['FileHash'] || '',
		fileSize: parseUint(map['FileSize']),
		narHash: map['NarHash'] || '',
		narSize: parseUint(map['NarSize']),
		references: map['References'] ? map['References'].split(/\s+/).filter(Boolean) : [],
		deriver: deriver && deriver !== 'unknown-deriver' ? deriver : undefined,
		sig: sigs.length > 0 ? sigs : undefined,
		ca: map['CA'] || undefined,
		raw
	};
}

/**
 * Formats a byte count using binary IEC units (B through PiB).
 */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const size = bytes / 1024 ** i;
	return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/**
 * Extracts the 32-character Nix base32 hash from a store path or bare hash prefix.
 */
export function extractStoreHash(input: string): string {
	const trimmed = input.trim();
	const match =
		trimmed.match(/\/nix\/store\/([0-9a-df-np-sv-z]{32})(?:$|[-/.])/i) ||
		trimmed.match(/^([0-9a-df-np-sv-z]{32})(?:$|-)/i);
	return match ? match[1].toLowerCase() : '';
}

/**
 * True when a bearer token is set but would travel over plain HTTP to a non-loopback host.
 */
export function tokenWithheld(
	endpoint: string,
	token?: string,
	baseOrigin = defaultBaseOrigin()
): boolean {
	if (!token?.trim() || isPublicNixCache(endpoint)) return false;
	const parsed = parseEndpointUrl(endpoint, baseOrigin);
	if (!parsed) return true;
	return parsed.protocol !== 'https:' && !isLoopbackHost(parsed.hostname);
}

function authHeaders(
	endpoint: string,
	token?: string,
	baseOrigin = defaultBaseOrigin()
): HeadersInit {
	const trimmed = token?.trim();
	if (!trimmed || isPublicNixCache(endpoint) || tokenWithheld(endpoint, trimmed, baseOrigin)) {
		return {};
	}
	return { Authorization: `Bearer ${trimmed}` };
}

function withTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
	const timeout = AbortSignal.timeout(timeoutMs);
	return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function formatFetchError(err: unknown, fallback: string): string {
	const isCors =
		typeof window !== 'undefined' &&
		err instanceof TypeError &&
		err.message.toLowerCase().includes('fetch');
	if (isCors) {
		return 'Network or CORS error. Verify cache reachability and CORS headers.';
	}
	return err instanceof Error ? err.message : fallback;
}

export function getNarinfoUrl(endpoint: string, cacheName: string, hashOrPath: string): string {
	const cleanHash = extractStoreHash(hashOrPath);
	const cacheBase = buildCacheBaseUrl(endpoint, cacheName);
	if (!cleanHash || !cacheBase) return '';
	return `${cacheBase}/${cleanHash}.narinfo`;
}

export function getNarDownloadUrl(endpoint: string, cacheName: string, narUrl: string): string {
	const trimmedNar = narUrl.trim();
	if (!trimmedNar || trimmedNar.startsWith('//')) return '';

	if (/^[a-z][a-z0-9+.-]*:/i.test(trimmedNar)) {
		try {
			const parsed = new URL(trimmedNar);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : '';
		} catch {
			return '';
		}
	}

	const cacheBase = buildCacheBaseUrl(endpoint, cacheName);
	if (!cacheBase) return '';
	return `${cacheBase}/${trimmedNar.replace(/^\/+/, '')}`;
}

/**
 * Queries /nix-cache-info to verify cache reachability, authentication, and priority metadata.
 */
export async function queryCacheInfo(
	endpoint: string,
	cacheName: string,
	token?: string,
	signal?: AbortSignal
): Promise<{
	ok: boolean;
	status: number;
	latencyMs: number;
	info?: CacheInfo;
	error?: string;
}> {
	const cacheBase = buildCacheBaseUrl(endpoint, cacheName);
	if (!cacheBase) {
		return { ok: false, status: 400, latencyMs: 0, error: 'Invalid cache endpoint URL' };
	}

	const start = performance.now();
	try {
		const res = await fetch(`${cacheBase}/nix-cache-info`, {
			headers: authHeaders(endpoint, token),
			signal: withTimeout(6000, signal)
		});
		const latencyMs = Math.round(performance.now() - start);

		if (res.ok) {
			const info = parseCacheInfo(await res.text());
			if (!info) {
				return {
					ok: false,
					status: res.status,
					latencyMs,
					error: 'Endpoint did not return valid nix-cache-info metadata'
				};
			}
			return { ok: true, status: res.status, latencyMs, info };
		}

		return {
			ok: false,
			status: res.status,
			latencyMs,
			error:
				res.status === 401
					? tokenWithheld(endpoint, token)
						? WITHHELD_MSG
						: 'Unauthorized (token required)'
					: `HTTP ${res.status}`
		};
	} catch (err: unknown) {
		return {
			ok: false,
			status: 0,
			latencyMs: Math.round(performance.now() - start),
			error: formatFetchError(err, 'Network error')
		};
	}
}

/**
 * Fetches and parses a .narinfo record from an Attic or standard Nix HTTP binary cache.
 */
export async function fetchNarInfo(
	endpoint: string,
	cacheName: string,
	hashOrPath: string,
	token?: string,
	signal?: AbortSignal
): Promise<{ ok: boolean; status: number; data?: NarInfo; error?: string }> {
	const cleanHash = extractStoreHash(hashOrPath);
	if (!cleanHash) {
		return { ok: false, status: 400, error: 'Invalid store path or 32-character Nix hash' };
	}

	const url = getNarinfoUrl(endpoint, cacheName, cleanHash);
	if (!url) {
		return { ok: false, status: 400, error: 'Invalid cache endpoint URL' };
	}

	try {
		const res = await fetch(url, {
			headers: authHeaders(endpoint, token),
			signal: withTimeout(8000, signal)
		});

		if (res.status === 404) {
			return { ok: false, status: 404, error: 'Path not found in cache' };
		}
		if (res.status === 401) {
			return {
				ok: false,
				status: 401,
				error: tokenWithheld(endpoint, token)
					? WITHHELD_MSG
					: 'Unauthorized: Bearer token required to inspect this path'
			};
		}
		if (!res.ok) {
			return { ok: false, status: res.status, error: `Server returned HTTP ${res.status}` };
		}

		const text = await res.text();
		if (HTML_PREFIX_RE.test(text)) {
			return { ok: false, status: 502, error: 'Endpoint returned HTML instead of .narinfo' };
		}
		const data = parseNarInfo(text);
		if (!data.storePath.startsWith('/')) {
			return { ok: false, status: 502, error: 'Malformed .narinfo response (missing StorePath)' };
		}
		return { ok: true, status: 200, data };
	} catch (err: unknown) {
		return { ok: false, status: 0, error: formatFetchError(err, 'Failed to fetch .narinfo') };
	}
}

export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

const noopStorage: StorageLike = {
	getItem: () => null,
	setItem: () => {},
	removeItem: () => {}
};

/**
 * Safely acquires window.localStorage without throwing when browser policy blocks Web Storage.
 */
export function getBrowserStorage(): StorageLike {
	try {
		return typeof window !== 'undefined' && window.localStorage ? window.localStorage : noopStorage;
	} catch {
		return noopStorage;
	}
}

function ownString(record: Record<string, string>, key: string): string | undefined {
	return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

const TOKENS_KEY = 'attic-tokens';

function readTokenMap(storage: StorageLike, baseOrigin?: string): Record<string, string> {
	let map: Record<string, string> = {};
	try {
		const raw = storage.getItem(TOKENS_KEY);
		if (raw) {
			const parsed: unknown = JSON.parse(raw);
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				for (const [k, v] of Object.entries(parsed)) {
					if (typeof v === 'string' && v.trim()) map[k] = v;
				}
			}
		}

		// Migrate single-slot legacy keys once without leaking across origins.
		const legacyToken = storage.getItem('attic-token');
		const legacyOrigin = storage.getItem('attic-token-origin') || baseOrigin || '';
		if (legacyToken?.trim() && legacyOrigin) {
			map[legacyOrigin] ??= legacyToken;
			storage.setItem(TOKENS_KEY, JSON.stringify(map));
			storage.removeItem('attic-token');
			storage.removeItem('attic-token-origin');
		}
	} catch {
		map = {};
	}
	return map;
}

/**
 * Loads the saved bearer token bound strictly to the endpoint's origin.
 */
export function loadTokenForEndpoint(
	storage: StorageLike,
	endpoint: string,
	baseOrigin = defaultBaseOrigin()
): string {
	const origin = endpointOrigin(endpoint, baseOrigin);
	if (!origin || isPublicNixCache(endpoint)) return '';
	const map = readTokenMap(storage, baseOrigin);
	return ownString(map, origin) ?? '';
}

/**
 * Persists or clears a bearer token scoped strictly to the endpoint's origin.
 */
export function saveTokenForEndpoint(
	storage: StorageLike,
	endpoint: string,
	token: string,
	baseOrigin = defaultBaseOrigin()
): void {
	const origin = endpointOrigin(endpoint, baseOrigin);
	if (!origin || isPublicNixCache(endpoint)) return;
	try {
		const map = readTokenMap(storage, baseOrigin);
		const trimmed = token.trim();
		if (trimmed) {
			map[origin] = trimmed;
		} else {
			delete map[origin];
		}
		storage.setItem(TOKENS_KEY, JSON.stringify(map));
	} catch {
		// Ignore quota / private-browsing storage errors.
	}
}

function escapeNixString(value: string): string {
	return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$\{/g, '\\${');
}

function sanitizeTokenWord(value: string): string {
	return value.replace(/\s+/g, '');
}

function shellQuote(value: string): string {
	if (/^[a-zA-Z0-9._:/-]+$/.test(value)) return value;
	return `'${value.replace(/'/g, `'\\''`)}'`;
}

export interface ClientSnippets {
	cacheUrl: string;
	nixos: string;
	nixconf: string;
	cli: string;
}

/**
 * Generates escaped NixOS, nix.conf, and CLI configuration snippets for a target cache.
 */
export function buildClientSnippets(
	endpoint: string,
	cacheName: string,
	publicKey?: string | null,
	baseOrigin = defaultBaseOrigin()
): ClientSnippets {
	const parsedEndpoint = parseEndpointUrl(endpoint, baseOrigin);
	const cleanEndpoint = parsedEndpoint ? parsedEndpoint.href.replace(/\/+$/, '') : PUBLIC_NIXOS_CACHE;
	const trimmedCache = cacheName.trim();
	const isNixosOrg = isPublicNixCache(cleanEndpoint);
	const cacheUrl =
		isNixosOrg || !trimmedCache
			? cleanEndpoint
			: `${cleanEndpoint}/${encodeURIComponent(trimmedCache)}`;
	const cleanKey = publicKey ? sanitizeTokenWord(publicKey.trim()) : '';

	if (isNixosOrg) {
		return {
			cacheUrl: PUBLIC_NIXOS_CACHE,
			nixos: `nix.settings = {\n  substituters = [\n    "${PUBLIC_NIXOS_CACHE}"\n  ];\n  trusted-public-keys = [\n    "${PUBLIC_NIXOS_KEY}"\n  ];\n};`,
			nixconf: `substituters = ${PUBLIC_NIXOS_CACHE}\ntrusted-public-keys = ${PUBLIC_NIXOS_KEY}`,
			cli: `# Query public NixOS cache directly via Nix CLI:\nnix path-info --store ${PUBLIC_NIXOS_CACHE} /nix/store/...`
		};
	}

	const nixosKeyLine = cleanKey
		? `"${escapeNixString(cleanKey)}"`
		: `# "${escapeNixString(trimmedCache || 'cache-name')}:<public-signing-key>"`;

	const nixos = `nix.settings = {
  substituters = [
    "${PUBLIC_NIXOS_CACHE}"
    "${escapeNixString(cacheUrl)}"
  ];
  trusted-public-keys = [
    "${PUBLIC_NIXOS_KEY}"
    ${nixosKeyLine}
  ];
};`;

	const nixconf = `substituters = ${PUBLIC_NIXOS_CACHE} ${sanitizeTokenWord(cacheUrl)}
trusted-public-keys = ${PUBLIC_NIXOS_KEY}${cleanKey ? ` ${cleanKey}` : ''}`;

	if (!trimmedCache) {
		return {
			cacheUrl,
			nixos,
			nixconf,
			cli: `# Query binary cache directly via Nix CLI:\nnix path-info --store ${shellQuote(cacheUrl)} /nix/store/...`
		};
	}

	const hostLabel =
		parseEndpointUrl(cleanEndpoint)
			?.hostname.split('.')[0]
			?.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
	const serverRef = `${hostLabel}:${trimmedCache}`;

	const cli = `# 1. Log in to the Attic server
attic login ${shellQuote(hostLabel)} ${shellQuote(cleanEndpoint)} <your-token>

# 2. Inspect cache metadata and signing key
attic cache info ${shellQuote(serverRef)}

# 3. Push store paths manually
attic push ${shellQuote(serverRef)} /nix/store/...

# 4. Watch local Nix store and push new builds automatically
attic watch-store ${shellQuote(serverRef)}`;

	return { cacheUrl, nixos, nixconf, cli };
}

/**
 * Sanitizes an untrusted JSON payload into a strongly typed RuntimeConfig.
 */
export function parseRuntimeConfig(raw: unknown, baseOrigin?: string): RuntimeConfig {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const obj = raw as Record<string, unknown>;
	const cfg: RuntimeConfig = {};

	if (typeof obj.subtitle === 'string' && obj.subtitle.trim()) cfg.subtitle = obj.subtitle.trim();
	if (typeof obj.footer === 'string' && obj.footer.trim()) cfg.footer = obj.footer.trim();
	if (typeof obj.defaultEndpoint === 'string' && resolveEndpoint(obj.defaultEndpoint, baseOrigin)) {
		cfg.defaultEndpoint = resolveEndpoint(obj.defaultEndpoint, baseOrigin);
	}
	if (typeof obj.defaultCache === 'string') cfg.defaultCache = obj.defaultCache.trim();
	if (typeof obj.upstreamFallback === 'boolean') cfg.upstreamFallback = obj.upstreamFallback;

	if (obj.publicKeys && typeof obj.publicKeys === 'object' && !Array.isArray(obj.publicKeys)) {
		const keys: Record<string, string> = {};
		for (const [k, v] of Object.entries(obj.publicKeys)) {
			if (typeof v === 'string' && v.trim()) keys[k] = v.trim();
		}
		if (Object.keys(keys).length > 0) cfg.publicKeys = keys;
	}

	if (Array.isArray(obj.presets)) {
		const presets: CachePreset[] = [];
		for (const item of obj.presets) {
			if (!item || typeof item !== 'object') continue;
			const p = item as Record<string, unknown>;
			const ep = typeof p.endpoint === 'string' ? resolveEndpoint(p.endpoint, baseOrigin) : '';
			if (!ep) continue;
			const label = typeof p.label === 'string' && p.label.trim() ? p.label.trim() : ep;
			const cacheName = typeof p.cacheName === 'string' ? p.cacheName.trim() : '';
			presets.push({ label, endpoint: ep, cacheName });
		}
		if (presets.length > 0) cfg.presets = presets;
	}

	if (Array.isArray(obj.samples)) {
		const samples: SamplePath[] = [];
		for (const item of obj.samples) {
			if (!item || typeof item !== 'object') continue;
			const s = item as Record<string, unknown>;
			const hash = typeof s.hash === 'string' ? extractStoreHash(s.hash) : '';
			const name = typeof s.name === 'string' ? s.name.trim() : '';
			if (!hash || !name || !NIX_HASH_RE.test(hash)) continue;
			samples.push({
				name,
				hash,
				description: typeof s.description === 'string' ? s.description.trim() : undefined,
				group: typeof s.group === 'string' && s.group.trim() ? s.group.trim() : undefined
			});
		}
		if (samples.length > 0) cfg.samples = samples;
	}

	if (obj.specs && typeof obj.specs === 'object' && !Array.isArray(obj.specs)) {
		const specs: Record<string, string> = {};
		for (const [k, v] of Object.entries(obj.specs)) {
			if (typeof v === 'string' && v.trim()) specs[k] = v.trim();
		}
		if (Object.keys(specs).length > 0) cfg.specs = specs;
	}

	return cfg;
}

/**
 * Loads optional runtime operator configuration from ./config.json.
 * Silently returns {} when absent (404) or when an SPA HTML fallback is returned.
 */
export async function loadRuntimeConfig(signal?: AbortSignal): Promise<RuntimeConfig> {
	try {
		const res = await fetch('./config.json', {
			cache: 'no-cache',
			signal: withTimeout(1500, signal)
		});
		if (!res.ok) return {};
		const text = await res.text();
		if (!text.trim() || HTML_PREFIX_RE.test(text)) return {};
		return parseRuntimeConfig(JSON.parse(text));
	} catch {
		return {};
	}
}

/**
 * Builds deduplicated endpoint presets from runtime config, hosting origin, and cache.nixos.org.
 */
export function buildPresets(
	runtimeConfig: RuntimeConfig,
	locationOrigin = defaultBaseOrigin()
): CachePreset[] {
	const list: CachePreset[] = [];
	const seen = new Set<string>();
	for (const p of runtimeConfig.presets ?? []) {
		const key = `${p.endpoint}::${p.cacheName}`;
		if (seen.has(key)) continue;
		seen.add(key);
		list.push(p);
	}

	const originUrl = locationOrigin ? parseEndpointUrl(locationOrigin) : null;
	if (originUrl && !isLoopbackHost(originUrl.hostname) && !isPublicNixCache(originUrl.origin)) {
		const cacheName = runtimeConfig.defaultCache ?? 'main';
		const key = `${originUrl.origin}::${cacheName}`;
		if (!seen.has(key) && !list.some((p) => p.endpoint === originUrl.origin)) {
			list.push({ label: originUrl.hostname, endpoint: originUrl.origin, cacheName });
			seen.add(key);
		}
	}

	if (!list.some((p) => isPublicNixCache(p.endpoint))) {
		list.push({ label: 'cache.nixos.org', endpoint: PUBLIC_NIXOS_CACHE, cacheName: '' });
	}
	return list;
}

/**
 * Resolves the initial cache endpoint and cache name across URL params, storage, config, and origin.
 */
export function resolveInitialTarget(
	params: URLSearchParams,
	storage: Pick<StorageLike, 'getItem'>,
	runtimeConfig: RuntimeConfig,
	locationOrigin = defaultBaseOrigin()
): { endpoint: string; cacheName: string } {
	const presets = buildPresets(runtimeConfig, locationOrigin);
	const urlCache = params.get('cache');
	const urlPreset = params.get('preset')?.trim();
	if (urlPreset) {
		const matched = presets.find(
			(p) =>
				p.label === urlPreset ||
				parseEndpointUrl(p.endpoint, locationOrigin)?.hostname === urlPreset
		);
		if (matched) {
			return {
				endpoint: matched.endpoint,
				cacheName: urlCache ?? matched.cacheName
			};
		}
	}

	const urlEndpoint = params.get('endpoint');
	if (urlEndpoint) {
		const resolved = resolveEndpoint(urlEndpoint, locationOrigin);
		if (resolved) {
			return {
				endpoint: resolved,
				cacheName: urlCache ?? (isPublicNixCache(resolved) ? '' : (runtimeConfig.defaultCache ?? ''))
			};
		}
	}

	try {
		const savedEndpoint = storage.getItem('attic-endpoint');
		if (savedEndpoint) {
			const resolved = resolveEndpoint(savedEndpoint, locationOrigin);
			if (resolved) {
				const savedCache = storage.getItem('attic-cache');
				return {
					endpoint: resolved,
					cacheName: urlCache ?? savedCache ?? ''
				};
			}
		}
	} catch {
		// Ignore storage read failures.
	}

	if (runtimeConfig.defaultEndpoint) {
		return {
			endpoint: runtimeConfig.defaultEndpoint,
			cacheName:
				urlCache ??
				(isPublicNixCache(runtimeConfig.defaultEndpoint) ? '' : (runtimeConfig.defaultCache ?? ''))
		};
	}

	const originUrl = locationOrigin ? parseEndpointUrl(locationOrigin) : null;
	if (originUrl && !isLoopbackHost(originUrl.hostname)) {
		return {
			endpoint: originUrl.origin,
			cacheName:
				urlCache ?? (isPublicNixCache(originUrl.origin) ? '' : (runtimeConfig.defaultCache ?? 'main'))
		};
	}

	return {
		endpoint: PUBLIC_NIXOS_CACHE,
		cacheName: urlCache ?? ''
	};
}

/**
 * Resolves a public signing key for the active endpoint/cache from runtime config or cache.nixos.org.
 */
export function resolvePublicKey(
	endpoint: string,
	cacheName: string,
	publicKeys?: Record<string, string>
): string | null {
	if (isPublicNixCache(endpoint)) return PUBLIC_NIXOS_KEY;
	if (!publicKeys) return null;
	const cleanEp = resolveEndpoint(endpoint);
	const cleanCache = cacheName.trim();
	const fullUrl = cleanEp && cleanCache ? `${cleanEp}/${cleanCache}` : cleanEp;
	return (
		(fullUrl ? ownString(publicKeys, fullUrl) : undefined) ??
		(cleanCache ? ownString(publicKeys, cleanCache) : undefined) ??
		(cleanEp ? ownString(publicKeys, cleanEp) : undefined) ??
		ownString(publicKeys, '*') ??
		null
	);
}

/**
 * Appends or rewinds an inspected Nix store path in the closure breadcrumb trail.
 */
export function updateBreadcrumbTrail(
	trail: BreadcrumbItem[],
	storePath: string,
	maxItems = 12
): BreadcrumbItem[] {
	const hash = extractStoreHash(storePath);
	if (!hash) return trail;

	const existingIdx = trail.findIndex((item) => item.hash === hash);
	if (existingIdx !== -1) {
		return trail.slice(0, existingIdx + 1);
	}

	const baseName = storePath.split('/').pop() ?? '';
	const dashIdx = baseName.indexOf('-');
	const label = dashIdx !== -1 && dashIdx < baseName.length - 1 ? baseName.slice(dashIdx + 1) : hash.slice(0, 8);
	return [...trail, { hash, label }].slice(-maxItems);
}
