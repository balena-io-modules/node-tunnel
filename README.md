node-tunnel
-----------

[![npm version](https://badge.fury.io/js/node-tunnel.svg)](http://npmjs.org/package/node-tunnel)
[![dependencies](https://david-dm.org/resin-io/node-tunnel.png)](https://david-dm.org/resin-io/node-tunnel.png)

HTTP tunneling proxy library.

Installation
------------

Install `node-tunnel` by running:

```sh
$ npm install node-tunnel
```

Documentation
-------------


* [createTunnel()](#create_tunnel) = <code>Tunnel</code>
* [Tunnel](#tunnel)
  * [.use( function(req, cltSocket, head, next) )](#tunnel.use)
  * [.listen(port)](#tunnel.listen)
* [basicAuth(req, cltSocket, head, next)](#basic_auth)
* [connect()](#connect)

<a name="create_tunnel"></a>
### createTunnel() = <code>Tunnel</code>
Create an HTTP tunneling proxy. The returned object has methods **use** and **listen**.

By default the proxy allows connections to any host and port, without authentication.

**Kind**: static method of <code>[node-tunnel](#module_token)</code>  
**Summary**: Create a tunneling proxy.  
**Returns**: <code>Tunnel object</code>  
**Access:** public  

**Example**  
```js
// Start a tunneling proxy on port 3128
tunnel = createTunnel()
tunnel.listen(3128)

// Use node "request" library to do an http request through the tunnel.
// Note the "tunnel" parameter set to true.
request( { url: "http://google.com", "proxy": "http://localhost:3128", tunnel: true}, function( err, response ) {
	console.log('response body', response.body);
} );
```

<a name="tunnel"></a>
### Tunnel

<a name="tunnel.use"></a>
### Tunnel.use( function(req, cltSocket, head, next) ) 
Use a middleware function for rewriting request destination (by changing req.url),
add authorization or filter connections to only certain hosts and ports.

The parameters are the same as the [http](https://nodejs.org/api/http.html#http_event_connect) module passes on "connect" event,
plus a callback function similar to [express](http://expressjs.com) middleware.

Keep in mind that express middleware do not work with in conjunction with this module.

**Kind**: method of <code>[Tunnel](#tunnel)</code>  
**Summary**: Use a middleware.  
**Access:** public  

**Example**  
```js
// Start a tunneling proxy on port 3128
tunnel = createTunnel()
tunnel.use( function(req, cltSocket, head, next) {
	// Send all connections to port 80 of localhost.
	req.url = "http://localhost:80";
	next();
} );
tunnel.listen(3128)
```
<a name="tunnel.listen"></a>
### Tunnel.listen(port, [cb])
Start listening on the given port. An optional callback function is called when tunnel is ready to listen.

**Kind**: method of <code>[Tunnel](#tunnel)</code>  
**Summary**: Start listening.  
**Access:** public  
**Example**  
```js
tunnel = createTunnel()
tunnel.listen(3128, function() {
	console.log("Tunnel listening on port 3128");
});
```

<a name="basic_auth"></a>
### basicAuth(req, cltSocket, head, next)
Parses Proxy-Authorization header and sets req.auth.username and req.auth.password properties.

Further middleware should be added to accept or reject connections based on this authentication information.
**Kind**: method of <code>[Tunnel](#tunnel)</code>	
**Summary**: Parse Proxy-Authorization header.
**Access:** public  
**Example**  
```js
tunnel = createTunnel()
tunnel.use(basicAuth);
tunnel.use( function(req, cltSocket, head, next) {
	if (req.auth.username != "user" || req.auth.password != "password") {
		cltSocket.end() // close connection
		return; // no further middleware need to be called
	}
	next();
} );
tunnel.listen(3128, function() {
	console.log("Tunnel listening on port 3128");
});
```

<a name="connect"></a>
### connect()
Synchronous function that creates a connection between the tunnel and the target server. It defaults to `net.connect` and returns a `net.Socket`

Support
-------

If you're having any problem, please [raise an issue](https://github.com/resin-io/node-tunnel/issues/new) on GitHub and the Resin.io team will be happy to help.

Tests
-----

Run the test suite by doing:

```sh
$ npm install && npm test
```

Contribute
----------

- Issue Tracker: [github.com/resin-io/node-tunnel/issues](https://github.com/resin-io/node-tunnel/issues)
- Source Code: [github.com/resin-io/node-tunnel](https://github.com/resin-io/node-tunnel)

Before submitting a PR, please make sure that you include tests, and that [coffeelint](http://www.coffeelint.org/) runs without any warning:

License
-------

The project is licensed under the MIT license.
