http = require 'http'
net = require 'net'
url = require 'url'
Promise = require 'bluebird'
basicAuthParser = require 'basic-auth-parser'
{ EventEmitter } = require 'events'
MiddlewareHandler = require 'middleware-handler'
MiddlewareHandler.prototype = Promise.promisifyAll(MiddlewareHandler.prototype)

# Connect an http socket to another tcp server.
# Based on tunneling proxy code from https://nodejs.org/api/http.html
connectSocket = ({ cltSocket, hostname, port, head, connect, req }) ->
	connect(port, hostname, cltSocket, req)
	.then (srvSocket) ->
		cltSocket.write('HTTP/1.0 200 Connection Established\r\nProxy-agent: Resin-VPN\r\n\r\n')
		srvSocket.write(head)
		srvSocket.pipe(cltSocket, end: false)
		cltSocket.pipe(srvSocket, end: false)

		Promise.fromNode (cb) ->
			cltSocket.on('error', cb)
			srvSocket.on('error', cb)
			cltSocket.on('end', cb)
			srvSocket.on('end', cb)
		.finally ->
			srvSocket.destroy()
			cltSocket.destroy()
	.catch (e) ->
		cltSocket.end('HTTP/1.0 500 Internal Server Error\r\n')
		cltSocket.destroy()
		throw e

# Create an http CONNECT tunneling proxy
# Expressjs-like middleware can be used to change destination (by modifying req.url)
# or for filtering requests (for example by terminating a socket early.)
#
# Returns an object with methods "listen" to start listening on a port,
# and "use" for adding middleware.
#
# Middleware are functions of the form (request, controlSocket, head, next).
exports.createTunnel = ->
	tunnel = new EventEmitter()

	middleware = new MiddlewareHandler()

	server = http.createServer (req, res) ->
		res.writeHead(405, 'Content-Type': 'text/plain')
		res.end('Method not allowed')

	server.on 'connect', (req, cltSocket, head) ->
		middleware.handleAsync([ req, cltSocket, head ])
		.then ->
			srvUrl = url.parse("http://#{req.url}")
			connectSocket
				cltSocket: cltSocket
				hostname: srvUrl.hostname
				port: srvUrl.port
				head: head
				connect: tunnel.connect
				req: req
			.then ->
				tunnel.emit('connect', srvUrl.hostname, srvUrl.port, head)
		.catch (err) ->
			tunnel.emit('error', err)
			cltSocket.destroy()

	tunnel.connect = Promise.method(net.connect)
	tunnel.use = middleware.use.bind(middleware)
	tunnel.listen = server.listen.bind(server)
	tunnel.close = server.close.bind(server)

	return tunnel

# Proxy authorization middleware for http tunnel.
exports.basicAuth = (req, cltSocket, head, next) ->
	if req.headers['proxy-authorization']?
		req.auth = basicAuthParser(req.headers['proxy-authorization'])
	next()
