declare module 'node:test' {
	export function describe(name: string, fn: () => void | Promise<void>): Promise<void>;
	export function it(name: string, fn: () => void | Promise<void>): Promise<void>;
	export function before(fn: () => void | Promise<void>): void;
	export function after(fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
	const assert: {
		equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
		notEqual(actual: unknown, expected: unknown, message?: string): void;
		deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
		ok(value: unknown, message?: string): asserts value;
		match(string: string, regexp: RegExp, message?: string): void;
		doesNotMatch(string: string, regexp: RegExp, message?: string): void;
		rejects(block: () => Promise<unknown>, error?: RegExp | Error, message?: string): Promise<void>;
	};
	export default assert;
}

declare module 'node:http' {
	export interface IncomingMessage {
		url?: string;
		method?: string;
		headers: Record<string, string | undefined>;
	}
	export interface ServerResponse {
		writeHead(statusCode: number, headers?: Record<string, string>): this;
		end(chunk?: string): this;
	}
	export interface AddressInfo {
		address: string;
		family: string;
		port: number;
	}
	export interface Server {
		listen(port: number, hostname: string, listeningListener?: () => void): this;
		address(): AddressInfo | string | null;
		close(callback?: (err?: Error) => void): this;
	}
	const http: {
		createServer(listener: (req: IncomingMessage, res: ServerResponse) => void): Server;
	};
	export default http;
}

declare module 'node:fs/promises' {
	export function readFile(path: string, encoding: 'utf8'): Promise<string>;
	export function readdir(path: string): Promise<string[]>;
	export function access(path: string): Promise<void>;
}
