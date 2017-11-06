declare module 'node-tunnel' {
	import * as Promise from 'bluebird';
	import * as http from 'http';
	import * as net from 'net';

	export class Request extends http.IncomingMessage {
		auth?: {
			username?: string;
			password?: string;
		};
		url: string;
	}

	export type Middleware = (req: Request, cltSocket: net.Socket, head: Buffer, next: () => void) => void;

	export class Tunnel extends NodeJS.EventEmitter {
		connect(port: number, host: string, client: net.Socket, req: Request): Promise<net.Socket>;
		use(middleware: Middleware): void;
		listen(path: string, callback?: Function): this;
		close(callback?: Function): this;
	}

	export const basicAuth: Middleware;

	export function createTunnel(): Tunnel;
}
