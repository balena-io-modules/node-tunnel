net = require 'net'
nodeTunnel = require '../index'
Promise = require 'bluebird'
request = Promise.promisify(require('request'))

{ expect } = require 'chai'

PORT = 3128

describe 'tunnel', ->
	describe 'proxy', ->
		# Sometimes connection takes a few seconds to be established and tests fail,
		# so set a generous timeout here.
		@timeout(10000)
		before (done) ->
			@tunnel = nodeTunnel.createTunnel()
			@tunnel.listen(PORT, done)

		after ->
			@tunnel.close()

		it 'should proxy http requests', (done) ->
			opts =
				url: 'https://api.resin.io/ping'
				proxy: 'http://localhost:' + PORT
				tunnel: true

			request(opts)
			.spread (res, body) ->
				expect(res.statusCode).to.equal(200)
				expect(body).to.equal('OK')
				done()

	describe 'events', ->
		# Some systems have huge dns lookup timeout, so set a timeout of 1 minute.
		# I suggest you have options timeout:1 on /etc/resolv.conf so this test runs faster.
		@timeout(60000)

		before (done) ->
			@tunnel = nodeTunnel.createTunnel()
			@events = []
			@tunnel.on 'connect', =>
				@events.push
					name: 'connect'
					data: arguments
			@tunnel.on 'error', =>
				@events.push
					name: 'error',
					data: arguments
			@tunnel.listen(PORT, done)

		after ->
			@tunnel.close()

		it 'should generate connect event on success', (done) ->
			@events = []

			opts =
				url: 'https://api.resin.io/ping'
				proxy: 'http://localhost:' + PORT
				tunnel: true

			request(opts)
			.delay(500)
			.then =>
				expect(@events.length).to.equal(1)
				expect(@events[0]).to.have.property('name').that.equals('connect')
				expect(@events[0]).to.have.deep.property('data[0]').that.equal('api.resin.io')
				expect(@events[0]).to.have.deep.property('data[1]').that.equal('443')
				done()

		it 'should generate connect and error events on error', (done) ->
			@events = []

			opts =
				url: 'https://api.resinosuchdomain.io/ping'
				proxy: 'http://localhost:' + PORT
				tunnel: true

			request(opts)
			.catch =>
				expect(@events.length).to.equal(1)
				expect(@events[0]).to.have.property('name').that.equals('error')
				expect(@events[0]).to.have.deep.property('data[0]').that.is.instanceof(Error)
				done()

	describe 'half-close connections between tunnel and server', ->
		# The test server listening on 8080 does not send a FIN packet back when it receives
		# one from VPN tunnel (allowHalfOpen setting). The VPN tunnel should anyway close the
		# connection fully from its side, or else the connection it will remain bound, indefinitely,
		# to the node process with a FIN_WAIT_2 state, therefore wasting resources.
		#
		# If the timeout is hit during tests then the VPN tunnel can potentially leak connections.
		@timeout(5000)

		# tunnel <-> server connection socket
		sock = null
		serverPort = 8080
		connectStr = "CONNECT localhost:#{serverPort} HTTP/1.0\r\nHost: localhost:#{serverPort}\r\n\r\n"

		beforeEach (done) ->
			@tunnel = nodeTunnel.createTunnel()
			@tunnel.connect = (port, host) ->
				sock = net.connect(port, host)
				new Promise (resolve, reject) ->
					sock
					.on('connect', resolve)
					.on('error', reject)
				.return(sock)
			@tunnel.listen(PORT, done)

		afterEach ->
			@tunnel.close()
			@server.close()

		it 'should be fully closed when client sends FIN', (done) ->
			@server = net.createServer allowHalfOpen: true, (socket) ->
				# tunnel <-> server connection properly closed from the tunnel side
				sock.on('close', done)

			@server.listen serverPort, ->
				socket = net.createConnection PORT, ->
					socket.write(connectStr)
					socket.on 'data', (data) ->
						# send FIN to tunnel server
						socket.end()

		it 'should be fully closed when server sends FIN', (done) ->
			@server = net.createServer allowHalfOpen: true, (socket) ->
				# tunnel <-> server connection properly closed from the tunnel side
				sock.on('close', done)
				# send FIN to tunnel server
				socket.end()

			@server.listen serverPort, ->
				socket = net.createConnection PORT, ->
					socket.write(connectStr)
