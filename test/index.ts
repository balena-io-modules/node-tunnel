import * as Promise from 'bluebird';
import { expect } from 'chai';
import * as net from 'net';
import * as rp from 'request-promise';

Promise.config({
	longStackTraces: true,
});

const request = rp.defaults({
	resolveWithFullResponse: true,
	simple: false,
});

import * as nodeTunnel from '../src/index';

const PORT = '3128';

describe('tunnel', function() {
	describe('proxy', function() {
		// Sometimes connection takes a few seconds to be established and tests fail,
		// so set a generous timeout here.
		this.timeout(10000);
		before(function(done) {
			this.tunnel = new nodeTunnel.Tunnel();
			return this.tunnel.listen(PORT, done);
		});

		after(function() {
			return this.tunnel.close();
		});

		return it('should proxy http requests', function(done) {
			const opts = {
				url: 'https://api.resin.io/ping',
				proxy: `http://localhost:${PORT}`,
				tunnel: true,
			};

			request.get(opts)
			.then((res) => {
				expect(res.statusCode).to.equal(200);
				expect(res.body).to.equal('OK');
				done();
			});
		});
	});

	describe('events', function() {
		// Some systems have huge dns lookup timeout, so set a timeout of 1 minute.
		// I suggest you have options timeout:1 on /etc/resolv.conf so this test runs faster.
		this.timeout(60000);

		before(function(done) {
			this.tunnel = new nodeTunnel.Tunnel();
			this.events = [];
			this.tunnel.on('connect', function(this: any) {
				return this.events.push({
					name: 'connect',
					data: arguments,
				});
			}.bind(this));
			this.tunnel.on('error', function(this: any) {
				return this.events.push({
					name: 'error',
					data: arguments,
				});
			}.bind(this));
			return this.tunnel.listen(PORT, done);
		});

		after(function() {
			return this.tunnel.close();
		});

		it('should generate connect event on success', function(done) {
			this.events = [];

			const opts = {
				url: 'https://api.resin.io/ping',
				proxy: `http://localhost:${PORT}`,
				tunnel: true,
			};

			request(opts)
			.promise()
			.delay(500)
			.then(() => {
				expect(this.events.length).to.equal(1);
				expect(this.events[0]).to.have.property('name').that.equals('connect');
				expect(this.events[0]).to.have.deep.property('data[0]').that.equal('api.resin.io');
				expect(this.events[0]).to.have.deep.property('data[1]').that.equal('443');
				done();
			});
		});

		return it('should generate connect and error events on error', function(done) {
			this.events = [];

			const opts = {
				url: 'https://api.resinosuchdomain.io/ping',
				proxy: `http://localhost:${PORT}`,
				tunnel: true,
			};

			request(opts)
			.catch(() => {
				expect(this.events.length).to.equal(1);
				expect(this.events[0]).to.have.property('name').that.equals('error');
				expect(this.events[0]).to.have.deep.property('data[0]').that.is.instanceof(Error);
				done();
			});
		});
	});

	return describe('half-close connections between tunnel and server', function() {
		// The test server listening on 8080 does not send a FIN packet back when it receives
		// one from VPN tunnel (allowHalfOpen setting). The VPN tunnel should anyway close the
		// connection fully from its side, or else the connection it will remain bound, indefinitely,
		// to the node process with a FIN_WAIT_2 state, therefore wasting resources.
		//
		// If the timeout is hit during tests then the VPN tunnel can potentially leak connections.
		this.timeout(5000);

		// tunnel <-> server connection socket
		let sock: net.Socket;
		const serverPort = 8080;
		const connectStr = `CONNECT localhost:${serverPort} HTTP/1.0\r\nHost: localhost:${serverPort}\r\n\r\n`;

		beforeEach(function(done) {
			this.tunnel = new nodeTunnel.Tunnel();
			this.tunnel.connect = function(port: number, host: string) {
				sock = net.connect(port, host);
				return new Promise(function(resolve, reject) {
					return sock
					.on('connect', resolve)
					.on('error', reject);
				}).return(sock);
			};
			this.tunnel.listen(PORT, done);
		});

		afterEach(function() {
			this.tunnel.close();
			this.server.close();
		});

		it('should be fully closed when client sends FIN', function(done) {
			this.server = net.createServer({allowHalfOpen: true}, _socket =>
				// tunnel <-> server connection properly closed from the tunnel side
				sock.on('close', done)
			);

			this.server.listen(serverPort, function() {
				let socket: net.Socket;
				socket = net.createConnection(PORT, function() {
					socket.write(connectStr);
					socket.on('data', _data =>
						// send FIN to tunnel server
						socket.end()
					);
				});
			});
		});

		it('should be fully closed when server sends FIN', function(done) {
			this.server = net.createServer({allowHalfOpen: true}, function(socket) {
				// tunnel <-> server connection properly closed from the tunnel side
				sock.on('close', done);
				// send FIN to tunnel server
				socket.end();
			});

			this.server.listen(serverPort, function() {
				let socket: net.Socket;
				socket = net.createConnection(PORT, () => socket.write(connectStr));
			});
		});
	});
});
