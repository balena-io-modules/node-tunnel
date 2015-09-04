{ createTunnel } = require '../index'
Promise = require 'bluebird'
request = Promise.promisify(require('request'))

{ expect } = require 'chai'

PORT = 8081

describe 'tunnel', ->
	describe 'proxy', ->
		before (done) ->
			@tunnel = createTunnel()
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
			@tunnel = createTunnel()
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
