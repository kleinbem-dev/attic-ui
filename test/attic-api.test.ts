import assert from 'node:assert/strict';
import http, { type AddressInfo, type Server } from 'node:http';
import { after, before, describe, it } from 'node:test';
import {
	buildClientSnippets,
	buildPresets,
	endpointOrigin,
	extractStoreHash,
	fetchNarInfo,
	formatBytes,
	getNarDownloadUrl,
	getNarinfoUrl,
	isPublicNixCache,
	loadTokenForEndpoint,
	PUBLIC_NIXOS_CACHE,
	PUBLIC_NIXOS_KEY,
	parseCacheInfo,
	parseNarInfo,
	parseRuntimeConfig,
	queryCacheInfo,
	resolveEndpoint,
	resolveInitialTarget,
	resolvePublicKey,
	saveTokenForEndpoint,
	type StorageLike,
	tokenWithheld,
	updateBreadcrumbTrail
} from '../src/lib/attic-api.ts';

const SAMPLE_HASH = '9l0j15jg8634hkb6d4c9y95mpxl0nhrd';
const SAMPLE_NARINFO = [
	`StorePath: /nix/store/${SAMPLE_HASH}-jq-1.8.2`,
	'URL: nar/1abc2def.nar.zst',
	'Compression: zstd',
	'FileHash: sha256:0123456789abcdef',
	'FileSize: 204800',
	'NarHash: sha256:fedcba9876543210',
	'NarSize: 614400',
	`References: ${SAMPLE_HASH}-jq-1.8.2 pqyiidz5mi73wv5f91d48s9plcqyj5bz-glibc-2.44`,
	'Deriver: 00000000000000000000000000000000-jq-1.8.2.drv',
	'Sig: cache.nixos.org-1:sigOne==',
	'Sig: custom-cache-1:sigTwo==',
	'CA: fixed:r:sha256:aaaa'
].join('\n');

function createMemoryStorage(initial: Record<string, string> = {}): StorageLike {
	const store = new Map<string, string>(Object.entries(initial));
	return {
		getItem: (key) => store.get(key) ?? null,
		setItem: (key, value) => {
			store.set(key, value);
		},
		removeItem: (key) => {
			store.delete(key);
		}
	};
}

describe('parseNarInfo & parseCacheInfo', () => {
	it('parses complete .narinfo records including multiple signatures and CA', () => {
		const parsed = parseNarInfo(SAMPLE_NARINFO);
		assert.equal(parsed.storePath, `/nix/store/${SAMPLE_HASH}-jq-1.8.2`);
		assert.equal(parsed.url, 'nar/1abc2def.nar.zst');
		assert.equal(parsed.compression, 'zstd');
		assert.equal(parsed.fileHash, 'sha256:0123456789abcdef');
		assert.equal(parsed.fileSize, 204800);
		assert.equal(parsed.narHash, 'sha256:fedcba9876543210');
		assert.equal(parsed.narSize, 614400);
		assert.deepEqual(parsed.references, [
			`${SAMPLE_HASH}-jq-1.8.2`,
			'pqyiidz5mi73wv5f91d48s9plcqyj5bz-glibc-2.44'
		]);
		assert.equal(parsed.deriver, '00000000000000000000000000000000-jq-1.8.2.drv');
		assert.deepEqual(parsed.sig, ['cache.nixos.org-1:sigOne==', 'custom-cache-1:sigTwo==']);
		assert.equal(parsed.ca, 'fixed:r:sha256:aaaa');
		assert.equal(parsed.raw, SAMPLE_NARINFO);
	});

	it('handles empty References, CRLF, unknown-deriver, and malformed numeric sizes', () => {
		const raw = [
			`StorePath: /nix/store/${SAMPLE_HASH}-empty`,
			'URL: https://cdn.example.org/nar/abc.nar',
			'FileHash: sha256:111',
			'FileSize: invalid-size',
			'NarHash: sha256:222',
			'NarSize: -999',
			'Deriver: unknown-deriver',
			'References: '
		].join('\r\n');

		const parsed = parseNarInfo(raw);
		assert.equal(parsed.storePath, `/nix/store/${SAMPLE_HASH}-empty`);
		assert.equal(parsed.compression, 'none');
		assert.equal(parsed.fileSize, 0);
		assert.equal(parsed.narSize, 0);
		assert.deepEqual(parsed.references, []);
		assert.equal(parsed.deriver, undefined);
		assert.equal(parsed.sig, undefined);
		assert.equal(parsed.ca, undefined);
	});

	it('validates nix-cache-info and rejects SPA HTML fallbacks or random text', () => {
		assert.equal(parseCacheInfo('<!doctype html><html><body>SPA</body></html>'), null);
		assert.equal(parseCacheInfo('<html>fallback</html>'), null);
		assert.equal(parseCacheInfo('hello: world\nfoo: bar'), null);
		assert.deepEqual(parseCacheInfo('StoreDir: /nix/store\nWantMassQuery: 1\nPriority: 41\n'), {
			storeDir: '/nix/store',
			wantMassQuery: 1,
			priority: 41
		});
	});
});

describe('formatBytes & extractStoreHash', () => {
	it('formats byte counts safely across boundaries, NaN, Infinity, and PiB', () => {
		assert.equal(formatBytes(0), '0 B');
		assert.equal(formatBytes(-42), '0 B');
		assert.equal(formatBytes(Number.NaN), '0 B');
		assert.equal(formatBytes(Number.POSITIVE_INFINITY), '0 B');
		assert.equal(formatBytes(512), '512 B');
		assert.equal(formatBytes(1024), '1.00 KiB');
		assert.equal(formatBytes(1536), '1.50 KiB');
		assert.equal(formatBytes(1048576), '1.00 MiB');
		assert.equal(formatBytes(1024 ** 5 * 2), '2.00 PiB');
	});

	it('extracts valid 32-char nix-base32 hashes and rejects invalid characters or lengths', () => {
		assert.equal(
			extractStoreHash(`  /nix/store/${SAMPLE_HASH}-jq-1.8.2/bin/jq  `),
			SAMPLE_HASH
		);
		assert.equal(extractStoreHash(SAMPLE_HASH.toUpperCase()), SAMPLE_HASH);
		assert.equal(extractStoreHash(`${SAMPLE_HASH}-glibc-2.44`), SAMPLE_HASH);
		assert.equal(extractStoreHash(''), '');
		assert.equal(extractStoreHash('abc123'), '');
		// Longer non-delimited hex string must not match a 32-char prefix
		assert.equal(extractStoreHash('0123456789abcdef0123456789abcdef01234567'), '');
		// 'e', 'o', 'u', 't' are excluded from Nix base32 alphabet
		assert.equal(extractStoreHash('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'), '');
		assert.equal(extractStoreHash('/nix/store/oooooooooooooooooooooooooooooooo-bad'), '');
	});
});

describe('URL resolution, scheme sanitization, and token security boundaries', () => {
	it('normalizes valid HTTP(S) and relative endpoints while rejecting unsafe schemes', () => {
		assert.equal(resolveEndpoint(' https://cache.example.org/// '), 'https://cache.example.org');
		assert.equal(resolveEndpoint('/proxy-cache/', 'http://localhost:4173'), '/proxy-cache');
		assert.equal(resolveEndpoint('javascript:alert(1)'), '');
		assert.equal(resolveEndpoint('data:text/html,<script>alert(1)</script>'), '');
		assert.equal(resolveEndpoint('//evil.example.org'), '');
		assert.equal(resolveEndpoint('not a url'), '');
	});

	it('identifies public NixOS cache and root-level vs multi-tenant cache URLs', () => {
		assert.equal(isPublicNixCache('https://cache.nixos.org'), true);
		assert.equal(isPublicNixCache('https://attic.example.org'), false);

		assert.equal(
			getNarinfoUrl('https://cache.nixos.org/', 'ignored', SAMPLE_HASH),
			`https://cache.nixos.org/${SAMPLE_HASH}.narinfo`
		);
		assert.equal(
			getNarinfoUrl('https://s3-cache.example.org/', '', SAMPLE_HASH),
			`https://s3-cache.example.org/${SAMPLE_HASH}.narinfo`
		);
		assert.equal(
			getNarinfoUrl('https://attic.example.org/', 'my cache', SAMPLE_HASH),
			`https://attic.example.org/my%20cache/${SAMPLE_HASH}.narinfo`
		);
		assert.equal(getNarinfoUrl('javascript:alert(1)', 'main', SAMPLE_HASH), '');
		assert.equal(getNarinfoUrl('https://attic.example.org', 'main', 'invalid'), '');

		assert.equal(
			getNarDownloadUrl('https://attic.example.org/', 'main', '/nar/xyz.nar.zst'),
			'https://attic.example.org/main/nar/xyz.nar.zst'
		);
		assert.equal(
			getNarDownloadUrl('https://s3-cache.example.org/', '', 'nar/xyz.nar.zst'),
			'https://s3-cache.example.org/nar/xyz.nar.zst'
		);
		assert.equal(
			getNarDownloadUrl('https://attic.example.org/', 'main', 'https://cdn.example.org/xyz.nar'),
			'https://cdn.example.org/xyz.nar'
		);
		assert.equal(
			getNarDownloadUrl('https://attic.example.org/', 'main', 'javascript:alert(1)'),
			''
		);
		assert.equal(getNarDownloadUrl('javascript:alert(1)', 'main', 'nar/xyz.nar'), '');
	});

	it('withholds bearer tokens over plain HTTP except loopback and supports relative localhost proxy', () => {
		assert.equal(tokenWithheld('https://attic.example.org', 'secret'), false);
		assert.equal(tokenWithheld('http://localhost:8080', 'secret'), false);
		assert.equal(tokenWithheld('http://127.0.0.1:8080', 'secret'), false);
		assert.equal(tokenWithheld('http://[::1]:8080', 'secret'), false);
		assert.equal(tokenWithheld('/proxy-cache', 'secret', 'http://localhost:4173'), false);
		assert.equal(tokenWithheld('/proxy-cache', 'secret', 'http://192.168.1.50:4173'), true);
		assert.equal(tokenWithheld('http://10.0.0.12:8080', 'secret'), true);
		assert.equal(tokenWithheld('http://attic.example.org', 'secret'), true);
		assert.equal(tokenWithheld('http://attic.example.org', ''), false);
		assert.equal(tokenWithheld('https://cache.nixos.org', 'secret'), false);
	});

	it('isolates saved bearer tokens strictly per origin and migrates legacy storage safely', () => {
		const storage = createMemoryStorage({
			'attic-token': 'legacy-secret',
			'attic-token-origin': 'https://cache-a.example.org'
		});

		// Legacy token restores ONLY for cache-a, never for cache-b
		assert.equal(loadTokenForEndpoint(storage, 'https://cache-a.example.org/sub'), 'legacy-secret');
		assert.equal(loadTokenForEndpoint(storage, 'https://cache-b.example.org'), '');
		assert.equal(storage.getItem('attic-token'), null);

		// Saving a token for cache-b does not overwrite cache-a's token
		saveTokenForEndpoint(storage, 'https://cache-b.example.org', 'token-b');
		assert.equal(loadTokenForEndpoint(storage, 'https://cache-a.example.org'), 'legacy-secret');
		assert.equal(loadTokenForEndpoint(storage, 'https://cache-b.example.org'), 'token-b');
		assert.equal(loadTokenForEndpoint(storage, 'https://evil.example.org'), '');

		// Clearing cache-a removes only cache-a
		saveTokenForEndpoint(storage, 'https://cache-a.example.org', '');
		assert.equal(loadTokenForEndpoint(storage, 'https://cache-a.example.org'), '');
		assert.equal(loadTokenForEndpoint(storage, 'https://cache-b.example.org'), 'token-b');

		assert.equal(endpointOrigin('/proxy-cache', 'http://localhost:4173'), 'http://localhost:4173');
	});
});

describe('buildClientSnippets & parseRuntimeConfig', () => {
	it('generates escaped NixOS, nix.conf, and portable Attic CLI snippets', () => {
		const attic = buildClientSnippets(
			'https://attic.example.org/',
			'prod',
			'prod:AbCdEf123456=='
		);
		assert.equal(attic.cacheUrl, 'https://attic.example.org/prod');
		assert.match(attic.nixos, /"https:\/\/attic\.example\.org\/prod"/);
		assert.match(attic.nixos, /"prod:AbCdEf123456=="/);
		assert.match(attic.nixconf, /substituters = https:\/\/cache\.nixos\.org https:\/\/attic\.example\.org\/prod/);
		assert.match(attic.cli, /attic login attic https:\/\/attic\.example\.org <your-token>/);
		assert.match(attic.cli, /attic watch-store attic:prod/);
		assert.doesNotMatch(attic.cli, /\/run\/current-system/);

		// Escapes Nix string interpolation attempts
		const tricky = buildClientSnippets('https://example.org', 'a"b${pkgs.hello}');
		assert.doesNotMatch(tricky.nixos, /"\$\{pkgs\.hello\}"/);
		assert.match(tricky.nixos, /\\\$\{pkgs\.hello\}/);

		// Public NixOS cache omits duplicate substituters
		const upstream = buildClientSnippets('https://cache.nixos.org', '');
		assert.equal(upstream.cacheUrl, 'https://cache.nixos.org');
		assert.match(upstream.cli, /nix path-info --store https:\/\/cache\.nixos\.org/);
	});

	it('sanitizes untrusted runtime config.json objects and strips invalid entries', () => {
		assert.deepEqual(parseRuntimeConfig(null), {});
		assert.deepEqual(parseRuntimeConfig(['bad']), {});

		const cfg = parseRuntimeConfig({
			subtitle: '  Team Binary Cache  ',
			defaultEndpoint: 'https://cache.example.org///',
			defaultCache: ' main ',
			upstreamFallback: true,
			presets: [
				{ label: 'Prod', endpoint: 'https://cache.example.org/', cacheName: 'main' },
				{ label: 'XSS', endpoint: 'javascript:alert(1)', cacheName: 'bad' }
			],
			samples: [
				{ name: 'jq', hash: `/nix/store/${SAMPLE_HASH}-jq-1.8.2`, group: 'Core' },
				{ name: 'bad', hash: 'not-a-hash' }
			],
			publicKeys: { main: 'main:pubKey==' },
			specs: { Compression: 'zstd', Empty: '   ' }
		});

		assert.equal(cfg.subtitle, 'Team Binary Cache');
		assert.equal(cfg.defaultEndpoint, 'https://cache.example.org');
		assert.equal(cfg.defaultCache, 'main');
		assert.equal(cfg.presets?.length, 1);
		assert.equal(cfg.presets?.[0].endpoint, 'https://cache.example.org');
		assert.equal(cfg.samples?.length, 1);
		assert.equal(cfg.samples?.[0].hash, SAMPLE_HASH);
		assert.deepEqual(cfg.specs, { Compression: 'zstd' });
	});
});

describe('HTTP integration: queryCacheInfo & fetchNarInfo', () => {
	let server: Server;
	let baseUrl = '';
	let lastAuthHeader: string | undefined;

	before(async () => {
		server = http.createServer((req, res) => {
			lastAuthHeader = req.headers.authorization;
			const url = req.url || '';

			if (url === '/public/nix-cache-info') {
				res.writeHead(200, { 'Content-Type': 'text/x-nix-cache-info' });
				res.end('StoreDir: /nix/store\nWantMassQuery: 1\nPriority: 41\n');
				return;
			}

			if (url === '/spa-fallback/nix-cache-info' || url === `/spa-fallback/${SAMPLE_HASH}.narinfo`) {
				res.writeHead(200, { 'Content-Type': 'text/html' });
				res.end('<!doctype html><html><body>200.html SPA fallback</body></html>');
				return;
			}

			if (url === '/malformed/nix-cache-info') {
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('hello world');
				return;
			}

			if (url === `/malformed/${SAMPLE_HASH}.narinfo`) {
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('Compression: zstd\nFileSize: 10\n');
				return;
			}

			if (url === '/slow/nix-cache-info') {
				setTimeout(() => {
					res.writeHead(200);
					res.end('StoreDir: /nix/store\n');
				}, 500);
				return;
			}

			if (url === '/private/nix-cache-info') {
				if (req.headers.authorization !== 'Bearer valid-jwt') {
					res.writeHead(401);
					res.end('Unauthorized');
					return;
				}
				res.writeHead(200, { 'Content-Type': 'text/x-nix-cache-info' });
				res.end('StoreDir: /nix/store\nWantMassQuery: 1\nPriority: 30\n');
				return;
			}

			if (url === `/public/${SAMPLE_HASH}.narinfo`) {
				res.writeHead(200, { 'Content-Type': 'text/x-nix-narinfo' });
				res.end(SAMPLE_NARINFO);
				return;
			}

			if (url === `/private/${SAMPLE_HASH}.narinfo`) {
				if (req.headers.authorization !== 'Bearer valid-jwt') {
					res.writeHead(401);
					res.end('Unauthorized');
					return;
				}
				res.writeHead(200, { 'Content-Type': 'text/x-nix-narinfo' });
				res.end(SAMPLE_NARINFO);
				return;
			}

			if (url.startsWith('/broken/')) {
				res.writeHead(502);
				res.end('Bad Gateway');
				return;
			}

			res.writeHead(404);
			res.end('Not Found');
		});

		await new Promise<void>((resolve) => {
			server.listen(0, '127.0.0.1', () => resolve());
		});
		const addr = server.address() as AddressInfo;
		baseUrl = `http://127.0.0.1:${addr.port}`;
	});

	after(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((err) => (err ? reject(err) : resolve()));
		});
	});

	it('queries public nix-cache-info and parses StoreDir, WantMassQuery, and Priority', async () => {
		const res = await queryCacheInfo(baseUrl, 'public');
		assert.equal(res.ok, true);
		assert.equal(res.status, 200);
		assert.deepEqual(res.info, {
			storeDir: '/nix/store',
			wantMassQuery: 1,
			priority: 41
		});
		assert.equal(lastAuthHeader, undefined);
	});

	it('rejects SPA 200.html HTML fallbacks and malformed payloads instead of reporting healthy', async () => {
		const htmlCache = await queryCacheInfo(baseUrl, 'spa-fallback');
		assert.equal(htmlCache.ok, false);
		assert.match(htmlCache.error || '', /nix-cache-info/i);

		const textCache = await queryCacheInfo(baseUrl, 'malformed');
		assert.equal(textCache.ok, false);

		const htmlNar = await fetchNarInfo(baseUrl, 'spa-fallback', SAMPLE_HASH);
		assert.equal(htmlNar.ok, false);
		assert.equal(htmlNar.status, 502);

		const malformedNar = await fetchNarInfo(baseUrl, 'malformed', SAMPLE_HASH);
		assert.equal(malformedNar.ok, false);
		assert.equal(malformedNar.status, 502);
	});

	it('rejects unsafe endpoint schemes before issuing network requests', async () => {
		const badInfo = await queryCacheInfo('javascript:alert(1)', 'system');
		assert.equal(badInfo.ok, false);
		assert.equal(badInfo.status, 400);

		const badNar = await fetchNarInfo('javascript:alert(1)', 'system', SAMPLE_HASH);
		assert.equal(badNar.ok, false);
		assert.equal(badNar.status, 400);
	});

	it('propagates AbortSignal cancellation immediately', async () => {
		const controller = new AbortController();
		const pending = queryCacheInfo(baseUrl, 'slow', undefined, controller.signal);
		controller.abort();
		const res = await pending;
		assert.equal(res.ok, false);
		assert.equal(res.status, 0);
	});

	it('authenticates against private cache over loopback and handles 401 rejection', async () => {
		const unauth = await queryCacheInfo(baseUrl, 'private');
		assert.equal(unauth.ok, false);
		assert.equal(unauth.status, 401);
		assert.match(unauth.error || '', /Unauthorized/i);

		const authed = await queryCacheInfo(baseUrl, 'private', '  valid-jwt  ');
		assert.equal(authed.ok, true);
		assert.equal(authed.info?.priority, 30);
		assert.equal(lastAuthHeader, 'Bearer valid-jwt');
	});

	it('fetches and parses .narinfo, handling 400, 401, 404, and 502 responses', async () => {
		const badInput = await fetchNarInfo(baseUrl, 'public', 'not-a-hash');
		assert.equal(badInput.ok, false);
		assert.equal(badInput.status, 400);

		const missing = await fetchNarInfo(baseUrl, 'public', '00000000000000000000000000000000');
		assert.equal(missing.ok, false);
		assert.equal(missing.status, 404);

		const unauth = await fetchNarInfo(baseUrl, 'private', SAMPLE_HASH);
		assert.equal(unauth.ok, false);
		assert.equal(unauth.status, 401);

		const ok = await fetchNarInfo(baseUrl, 'private', SAMPLE_HASH, 'valid-jwt');
		assert.equal(ok.ok, true);
		assert.equal(ok.status, 200);
		assert.equal(ok.data?.storePath, `/nix/store/${SAMPLE_HASH}-jq-1.8.2`);

		const upstreamErr = await fetchNarInfo(baseUrl, 'broken', SAMPLE_HASH);
		assert.equal(upstreamErr.ok, false);
		assert.equal(upstreamErr.status, 502);
	});

	it('handles unreachable endpoints cleanly without throwing', async () => {
		const dead = await queryCacheInfo('http://127.0.0.1:1', 'system');
		assert.equal(dead.ok, false);
		assert.equal(dead.status, 0);
		assert.ok(dead.error);
	});
});

describe('Target resolution, presets, public keys, and breadcrumb state', () => {
	it('builds deduplicated presets from runtime config, non-loopback origin, and cache.nixos.org', () => {
		const devPresets = buildPresets({}, 'http://localhost:5173');
		assert.deepEqual(devPresets, [
			{ label: 'cache.nixos.org', endpoint: PUBLIC_NIXOS_CACHE, cacheName: '' }
		]);

		const prodPresets = buildPresets({ defaultCache: 'ci' }, 'https://attic.example.org');
		assert.deepEqual(prodPresets, [
			{ label: 'attic.example.org', endpoint: 'https://attic.example.org', cacheName: 'ci' },
			{ label: 'cache.nixos.org', endpoint: PUBLIC_NIXOS_CACHE, cacheName: '' }
		]);
	});

	it('resolves initial target priority across URL params, storage, runtime config, and origin', () => {
		const emptyStorage = createMemoryStorage();

		// Loopback dev without config defaults to cache.nixos.org so out-of-the-box checks work
		assert.deepEqual(
			resolveInitialTarget(new URLSearchParams(), emptyStorage, {}, 'http://127.0.0.1:5173'),
			{ endpoint: PUBLIC_NIXOS_CACHE, cacheName: '' }
		);

		// Production origin auto-detects same-origin Attic endpoint
		assert.deepEqual(
			resolveInitialTarget(new URLSearchParams(), emptyStorage, {}, 'https://cache.example.org'),
			{ endpoint: 'https://cache.example.org', cacheName: 'main' }
		);

		// Runtime config overrides auto-detection
		const cfg = { defaultEndpoint: 'https://attic.internal.example', defaultCache: 'system' };
		assert.deepEqual(
			resolveInitialTarget(new URLSearchParams(), emptyStorage, cfg, 'https://ui.example.org'),
			{ endpoint: 'https://attic.internal.example', cacheName: 'system' }
		);

		// Saved localStorage overrides runtime config
		const savedStorage = createMemoryStorage({
			'attic-endpoint': 'https://saved.example.org/',
			'attic-cache': 'dev'
		});
		assert.deepEqual(
			resolveInitialTarget(new URLSearchParams(), savedStorage, cfg, 'https://ui.example.org'),
			{ endpoint: 'https://saved.example.org', cacheName: 'dev' }
		);

		// URL query overrides storage, while unsafe schemes fall through safely
		assert.deepEqual(
			resolveInitialTarget(
				new URLSearchParams('endpoint=https://override.example.org&cache=prod'),
				savedStorage,
				cfg,
				'https://ui.example.org'
			),
			{ endpoint: 'https://override.example.org', cacheName: 'prod' }
		);
		assert.deepEqual(
			resolveInitialTarget(
				new URLSearchParams('endpoint=javascript:alert(1)'),
				savedStorage,
				cfg,
				'https://ui.example.org'
			),
			{ endpoint: 'https://saved.example.org', cacheName: 'dev' }
		);
	});

	it('resolves public keys for cache.nixos.org and configured caches', () => {
		assert.equal(resolvePublicKey(PUBLIC_NIXOS_CACHE, ''), PUBLIC_NIXOS_KEY);
		const keys = {
			system: 'system:keyA=',
			'https://attic.example.org/prod': 'prod:keyB='
		};
		assert.equal(resolvePublicKey('https://attic.example.org', 'prod', keys), 'prod:keyB=');
		assert.equal(resolvePublicKey('https://attic.example.org', 'system', keys), 'system:keyA=');
		assert.equal(resolvePublicKey('https://attic.example.org', 'other', keys), null);
		// Object.prototype property names must never leak functions as signing keys
		assert.equal(resolvePublicKey('https://attic.example.org', 'constructor', keys), null);
		assert.equal(resolvePublicKey('https://attic.example.org', 'toString', keys), null);
	});

	it('canonicalizes schemeless-slash URLs, deduplicates configured presets, and resolves relative snippet URLs', () => {
		assert.equal(resolveEndpoint('https:cache-a.example.org/'), 'https://cache-a.example.org');
		assert.equal(resolveEndpoint('/proxy-cache/', 'http://localhost:4173'), '/proxy-cache');

		const dupPresets = buildPresets(
			{
				presets: [
					{ label: 'One', endpoint: 'https://a.example.org', cacheName: 'main' },
					{ label: 'Dup', endpoint: 'https://a.example.org', cacheName: 'main' }
				]
			},
			'http://localhost:4173'
		);
		assert.equal(dupPresets.filter((p) => p.endpoint === 'https://a.example.org').length, 1);

		const relSnippets = buildClientSnippets(
			'/proxy-cache',
			'my cache',
			null,
			'http://localhost:4173'
		);
		assert.equal(relSnippets.cacheUrl, 'http://localhost:4173/proxy-cache/my%20cache');
		assert.match(relSnippets.cli, /attic login localhost http:\/\/localhost:4173\/proxy-cache/);
		assert.match(relSnippets.cli, /'localhost:my cache'/);
	});

	it('appends, rewinds, and caps closure breadcrumb history cleanly', () => {
		const h1 = '9l0j15jg8634hkb6d4c9y95mpxl0nhrd';
		const h2 = 'pqyiidz5mi73wv5f91d48s9plcqyj5bz';
		const h3 = '5lpg7j8y8lf8c4zv318yi4rmgyn5yhip';

		let trail = updateBreadcrumbTrail([], `/nix/store/${h1}-jq-1.8.2`);
		trail = updateBreadcrumbTrail(trail, `/nix/store/${h2}-glibc-2.44`);
		trail = updateBreadcrumbTrail(trail, `/nix/store/${h3}-curl-8.22.0`);
		assert.deepEqual(
			trail.map((t) => t.label),
			['jq-1.8.2', 'glibc-2.44', 'curl-8.22.0']
		);

		// Revisiting an earlier node rewinds downstream trail items
		const rewound = updateBreadcrumbTrail(trail, `/nix/store/${h2}-glibc-2.44`);
		assert.deepEqual(
			rewound.map((t) => t.label),
			['jq-1.8.2', 'glibc-2.44']
		);

		// Caps history length to maxItems
		const capped = updateBreadcrumbTrail(trail, `/nix/store/${h1}`, 2);
		assert.equal(capped.length, 1);
		const cappedTwo = updateBreadcrumbTrail(
			updateBreadcrumbTrail(capped, `/nix/store/${h2}-glibc-2.44`, 2),
			`/nix/store/${h3}-curl-8.22.0`,
			2
		);
		assert.deepEqual(
			cappedTwo.map((t) => t.label),
			['glibc-2.44', 'curl-8.22.0']
		);
	});
});
