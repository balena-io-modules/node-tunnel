declare module 'basic-auth-parser' {
	interface BasicAuth {
		scheme: string;
		username?: string;
		password?: string;
	}

	const parser: (auth: string | string[]) => BasicAuth;
	export = parser;
}