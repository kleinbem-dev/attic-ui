import type { CacheInfo, NarInfo } from './types';

/**
 * Parses raw Nix .narinfo format into a structured NarInfo object.
 */
export function parseNarInfo(raw: string): NarInfo {
	const lines = raw.trim().split('\n');
	const map: Record<string, string> = {};
	const sigs: string[] = [];

	for (const line of lines) {
		const colonIdx = line.indexOf(':');
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const val = line.slice(colonIdx + 1).trim();

		if (key === 'Sig') {
			sigs.push(val);
		} else {
			map[key] = val;
		}
	}

	return {
		storePath: map['StorePath'] || '',
		url: map['URL'] || '',
		compression: map['Compression'] || 'none',
		fileHash: map['FileHash'] || '',
		fileSize: parseInt(map['FileSize'] || '0', 10),
		narHash: map['NarHash'] || '',
		narSize: parseInt(map['NarSize'] || '0', 10),
		references: map['References'] ? map['References'].split(/\s+/).filter(Boolean) : [],
		deriver: map['Deriver'],
		sig: sigs.length > 0 ? sigs : undefined,
		ca: map['CA'],
		raw
	};
}

/**
 * Formats a byte number to human-readable binary size (KiB, MiB, GiB).
 */
export function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return '0 B';
	const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = bytes / Math.pow(1024, i);
	return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/**
 * Extracts the 32-character Nix hash from a full /nix/store path or a bare hash.
 * Returns '' when the input contains neither.
 */
export function extractStoreHash(input: string): string {
	const trimmed = input.trim();
	const match = trimmed.match(/\/nix\/store\/([0-9a-df-np-sv-z]{32})/i) || trimmed.match(/^([0-9a-df-np-sv-z]{32})/i);
	return match ? match[1] : '';
}

/**
 * Shared classifier to test if an endpoint targets the official public NixOS cache.
 */
export function isPublicNixCache(endpoint: string): boolean {
	try {
		const parsed = new URL(endpoint.trim());
		return parsed.hostname === 'cache.nixos.org';
	} catch {
		return false;
	}
}

/**
 * Builds request headers; the bearer token only goes over HTTPS or to loopback,
 * since the endpoint is free text and plain http would leak it.
 */
function authHeaders(endpoint: string, token?: string): HeadersInit {
	if (!token || isPublicNixCache(endpoint) || tokenWithheld(endpoint, token)) return {};
	return { Authorization: `Bearer ${token.trim()}` };
}

/** True when a token is set but would travel over plain HTTP to a non-loopback host. */
export function tokenWithheld(endpoint: string, token?: string): boolean {
	if (!token || isPublicNixCache(endpoint)) return false;
	try {
		const { protocol, hostname } = new URL(endpoint.trim());
		const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
		return protocol !== 'https:' && !loopback;
	} catch {
		return true;
	}
}

const WITHHELD_MSG = 'Token not sent over plain HTTP: use an https:// endpoint';

/**
 * Resolves the effective base URL, routing through local Vite proxy on localhost
 * to bypass CORS when connecting to cache.kleinbem.dev.
 */
export function resolveEndpoint(endpoint: string): string {
	const clean = endpoint.trim().replace(/\/+$/, '');
	if (
		typeof window !== 'undefined' &&
		(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
	) {
		try {
			const parsed = new URL(clean);
			if (parsed.hostname === 'cache.kleinbem.dev') {
				const prefix = parsed.pathname.replace(/\/+$/, '');
				return `/proxy-cache${prefix}`;
			}
		} catch {}
	}
	return clean;
}

/**
 * Tests connectivity and queries cache info.
 */
export async function queryCacheInfo(
	endpoint: string,
	cacheName: string,
	token?: string
): Promise<{
	ok: boolean;
	status: number;
	latencyMs: number;
	info?: CacheInfo;
	error?: string;
}> {
	const start = performance.now();
	const base = resolveEndpoint(endpoint);
	const isNixOSPublic = isPublicNixCache(endpoint);
	const url = isNixOSPublic
		? `${base}/nix-cache-info`
		: `${base}/${encodeURIComponent(cacheName)}/nix-cache-info`;

	try {
		const headers = authHeaders(endpoint, token);

		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(6000)
		});

		const latencyMs = Math.round(performance.now() - start);

		if (res.ok) {
			const text = await res.text();
			const info: CacheInfo = {
				storeDir: '/nix/store',
				wantMassQuery: 0,
				priority: 40
			};
			for (const line of text.split('\n')) {
				const [k, v] = line.split(':').map((s) => s.trim());
				if (k === 'StoreDir') info.storeDir = v;
				if (k === 'WantMassQuery') info.wantMassQuery = parseInt(v, 10);
				if (k === 'Priority') info.priority = parseInt(v, 10);
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
		const latencyMs = Math.round(performance.now() - start);
		const isCors =
			typeof window !== 'undefined' &&
			err instanceof TypeError &&
			err.message.toLowerCase().includes('fetch');
		const errorMsg = isCors
			? 'Network or CORS error. Verify cache reachability, or check browser CORS restrictions.'
			: err instanceof Error
				? err.message
				: 'Network error';
		return {
			ok: false,
			status: 0,
			latencyMs,
			error: errorMsg
		};
	}
}

/**
 * Fetches and parses .narinfo for a given hash from Attic or public binary cache.
 */
export async function fetchNarInfo(
	endpoint: string,
	cacheName: string,
	hash: string,
	token?: string
): Promise<{ ok: boolean; status: number; data?: NarInfo; error?: string }> {
	const cleanHash = extractStoreHash(hash);
	if (!cleanHash) {
		return { ok: false, status: 400, error: 'Invalid store path or hash' };
	}

	const base = resolveEndpoint(endpoint);
	const isNixOSPublic = isPublicNixCache(endpoint);
	const url = isNixOSPublic
		? `${base}/${cleanHash}.narinfo`
		: `${base}/${encodeURIComponent(cacheName)}/${cleanHash}.narinfo`;

	try {
		const headers = authHeaders(endpoint, token);

		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(8000)
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
					: 'Unauthorized: Token required to view this path'
			};
		}
		if (!res.ok) {
			return { ok: false, status: res.status, error: `Server returned HTTP ${res.status}` };
		}

		const text = await res.text();
		return { ok: true, status: 200, data: parseNarInfo(text) };
	} catch (err: unknown) {
		const isCors =
			typeof window !== 'undefined' &&
			err instanceof TypeError &&
			err.message.toLowerCase().includes('fetch');
		const errorMsg = isCors
			? 'Network or CORS error fetching .narinfo. Verify endpoint reachability and permissions.'
			: err instanceof Error
				? err.message
				: 'Failed to fetch .narinfo';
		return { ok: false, status: 0, error: errorMsg };
	}
}
