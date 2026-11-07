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
 * Extracts the 32-character Nix hash from a full /nix/store path or returns clean hash.
 */
export function extractStoreHash(input: string): string {
	const trimmed = input.trim();
	const match = trimmed.match(/\/nix\/store\/([0-9a-df-np-sv-z]{32})/i) || trimmed.match(/^([0-9a-df-np-sv-z]{32})/i);
	return match ? match[1] : trimmed;
}

/**
 * Tests connectivity and queries cache info.
 */
export async function queryCacheInfo(endpoint: string, cacheName: string, token?: string): Promise<{
	ok: boolean;
	status: number;
	latencyMs: number;
	info?: CacheInfo;
	error?: string;
}> {
	const start = performance.now();
	const base = endpoint.replace(/\/+$/, '');
	const url = `${base}/${cacheName}/nix-cache-info`;

	try {
		const headers: HeadersInit = {};
		if (token) {
			headers['Authorization'] = `Bearer ${token.trim()}`;
		}

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
			error: res.status === 401 ? 'Unauthorized (token required)' : `HTTP ${res.status}`
		};
	} catch (err: unknown) {
		const latencyMs = Math.round(performance.now() - start);
		return {
			ok: false,
			status: 0,
			latencyMs,
			error: err instanceof Error ? err.message : 'Network error'
		};
	}
}

/**
 * Fetches and parses .narinfo for a given hash from Attic.
 */
export async function fetchNarInfo(
	endpoint: string,
	cacheName: string,
	hash: string,
	token?: string
): Promise<{ ok: boolean; data?: NarInfo; error?: string }> {
	const base = endpoint.replace(/\/+$/, '');
	const cleanHash = extractStoreHash(hash);
	const url = `${base}/${cacheName}/${cleanHash}.narinfo`;

	try {
		const headers: HeadersInit = {};
		if (token) {
			headers['Authorization'] = `Bearer ${token.trim()}`;
		}

		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(8000)
		});

		if (res.status === 404) {
			return { ok: false, error: 'Path not found in cache' };
		}
		if (res.status === 401) {
			return { ok: false, error: 'Unauthorized: Token required to view this path' };
		}
		if (!res.ok) {
			return { ok: false, error: `Server returned HTTP ${res.status}` };
		}

		const text = await res.text();
		return { ok: true, data: parseNarInfo(text) };
	} catch (err: unknown) {
		return { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch .narinfo' };
	}
}
