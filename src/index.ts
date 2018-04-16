/*
   Copyright 2018 Resin.io

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
import basicAuthParser = require('basic-auth-parser');
import * as Promise from 'bluebird';
import { EventEmitter } from 'events';
import * as http from 'http';
import MiddlewareHandler = require('middleware-handler');
import * as net from 'net';
import * as url from 'url';

interface MiddlewareHandlerAsync extends MiddlewareHandler {
	handleAsync(args?: any[]): Promise<void>;
}
MiddlewareHandler.prototype = Promise.promisifyAll(MiddlewareHandler.prototype) as MiddlewareHandlerAsync;

export type NetConnectPromise = (port: number, hostname: string, cltSocket: net.Socket, req: Request) => Promise<net.Socket>;

interface ConnectSocketOptions {
	cltSocket: net.Socket;
	hostname: string;
	port: number;
	head: Buffer;
	connect: NetConnectPromise;
	req: Request;
}

// Connect an http socket to another tcp server.
// Based on tunneling proxy code from https://nodejs.org/api/http.html
const connectSocket = ({ cltSocket, hostname, port, head, connect, req }: ConnectSocketOptions) =>
	connect(port, hostname, cltSocket, req)
	.then((srvSocket) => {
		cltSocket.write('HTTP/1.0 200 Connection Established\r\nProxy-agent: Resin-VPN\r\n\r\n');
		srvSocket.write(head);
		srvSocket.pipe(cltSocket, {end: false});
		cltSocket.pipe(srvSocket, {end: false});

		return Promise.fromCallback((cb) => {
			cltSocket.on('error', cb);
			srvSocket.on('error', cb);
			cltSocket.on('end', cb);
			srvSocket.on('end', cb);
		}).finally(() => {
			srvSocket.destroy();
			cltSocket.destroy();
		});
	}).tapCatch(() => {
		cltSocket.end('HTTP/1.0 500 Internal Server Error\r\n');
		cltSocket.destroy();
	});

// Create an http CONNECT tunneling proxy
// Expressjs-like middleware can be used to change destination (by modifying req.url)
// or for filtering requests (for example by terminating a socket early.)
//
// Returns an object with methods "listen" to start listening on a port,
// and "use" for adding middleware.
//
// Middleware are functions of the form (request, controlSocket, head, next).
export class Request extends http.IncomingMessage {
	auth?: {
		username?: string;
		password?: string;
	};
}

export class Tunnel extends EventEmitter {
	private server = http.createServer((_req, res) => {
		res.writeHead(405, {'Content-Type': 'text/plain'});
		res.end('Method not allowed');
	});
	private middleware = new MiddlewareHandler() as MiddlewareHandlerAsync;

	constructor() {
		super();

		this.use(basicAuth);
		this.server.on('connect', (req: Request, cltSocket: net.Socket, head: Buffer) =>
			this.middleware.handleAsync([ req, cltSocket, head ])
			.then(() => {
				const { hostname, port } = url.parse(`http://${req.url}`);
				if (hostname == null || port == null) {
					throw new Error('Invalid Request: Hostname or Port missing');
				}
				return connectSocket({
					cltSocket,
					hostname,
					port: parseInt(port, 10),
					head,
					connect: this.connect,
					req,
				})
				.then(() =>
					this.emit('connect', hostname, port, head)
				);
			}).catch((err) => {
				this.emit('error', err);
				cltSocket.destroy();
			})
		);
	}

	connect(port: number, host: string, _cltSocket: net.Socket, _req: Request): Promise<net.Socket> {
		const socket = net.connect(port, host);
		return new Promise((resolve, reject) => {
			socket.on('connect', () => resolve(socket));
			socket.on('error', reject);
		});
	}
	use: (middleware: Middleware) => void = this.middleware.use.bind(this.middleware);
	listen: (port: number | string, callback?: (err: any, result?: any) => void) => this = this.server.listen.bind(this.server);
	close: (callback?: (error?: Error) => void) => this = this.server.close.bind(this.server);
}

// for backwards compatibility
export const createTunnel = (): Tunnel => new Tunnel();

// Proxy authorization middleware for http tunnel.
export type Middleware = (req: Request, cltSocket: net.Socket, head: Buffer, next: () => void) => void;
export const basicAuth: Middleware = (req, _cltSocket, _head, next) => {
	const proxyAuth = req.headers['proxy-authorization'];
	if (proxyAuth != null) {
		req.auth = basicAuthParser(proxyAuth);
	}
	return next();
};
