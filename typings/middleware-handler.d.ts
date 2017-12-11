declare module 'middleware-handler' {
	import * as net from "net";

	type Middleware = (req: Request, cltSocket: net.Socket, head: Buffer, next: () => void) => void;

	class MiddlewareHandler {
		use(middleware: Middleware): void;
		handle(args?: any[], callback?: Function): void;
	}

	export = MiddlewareHandler
}