export interface CacheEndpointConfig {
	url: string;
	cacheName: string;
	token?: string;
}

export interface NarInfo {
	storePath: string;
	url: string;
	compression: string;
	fileHash: string;
	fileSize: number;
	narHash: string;
	narSize: number;
	references: string[];
	deriver?: string;
	sig?: string[];
	ca?: string;
	raw: string;
}

export interface CacheInfo {
	storeDir: string;
	wantMassQuery: number;
	priority: number;
}

export type CacheStatus = 'healthy' | 'degraded' | 'down' | 'checking' | 'unknown';

export interface CacheTelemetryData {
	status: CacheStatus;
	endpoint: string;
	cacheName: string;
	latencyMs: number | null;
	authRequired: boolean;
	authenticated: boolean;
	errorMessage?: string;
	upstreamCaches: string[];
	chunking: {
		narThreshold: string;
		avgChunkSize: string;
		compression: string;
	};
	retention: {
		schedule: string;
		reaperHost: string;
	};
}
