# v0.2.2

* Destroy both client<->tunnel and tunnel<->server sockets when either client or server sends a FIN packet

# v0.2.1

* Handle exception when domain does not exist.
* Made sure tests must pass in order to publish.
* Made sure tests are run against latest code changes.

# v0.2.0

* Added support for half-open connections.

# v0.1.1

* Emit connect/connected/error events for logging and error handling
* Add "close" method for closing the tunnel.

# v0.1.0

* Send HTTP/1.0 200 message on success to support old nc versions.
