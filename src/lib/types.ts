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

export interface CachePreset {
	label: string;
	endpoint: string;
	cacheName: string;
}

export interface SamplePath {
	name: string;
	hash: string;
	description?: string;
	group?: string;
}

export interface BreadcrumbItem {
	hash: string;
	label: string;
}

export interface RuntimeConfig {
	subtitle?: string;
	footer?: string;
	defaultEndpoint?: string;
	defaultCache?: string;
	upstreamFallback?: boolean;
	publicKeys?: Record<string, string>;
	presets?: CachePreset[];
	samples?: SamplePath[];
	specs?: Record<string, string>;
}
