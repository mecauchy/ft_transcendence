import {readFileSync, existsSync} from 'fs';

// vault token read from file or env helper function
function	getVaultToken(): string {
	// check for env var
	if (process.env.VAULT_TOKEN)
		return process.env.VAULT_TOKEN;

	// else, try read from file
	const tokenFile = process.env.VAULT_TOKEN_FILE || '/tmp/vault_token';
	if (existsSync(tokenFile)) {
		return (readFileSync(tokenFile, 'utf-8').trim());
	}
	
	// if in dev, you can ignore and use the devtoken
	// in production, require token
	if (process.env.NODE_ENV === 'production')
		throw new Error('VAULT_TOKEN or VAULT_TOKEN_FILE must be set in production');
	
	return ('root_token_dev_only');
}

// config for the containers
export const config = {
	// entrypoint config
	port:		parseInt(process.env.PORT || '3000'),
	host:		process.env.HOST || '0.0.0.0',
	logLevel:	(process.env.LOG_LEVEL || 'info') as 'info' | 'debug' | 'warn' | 'error',

	// redis config
	redis: {
		host:	process.env.REDIS_HOST || 'redis',
		port:	parseInt(process.env.REDIS_PORT || '6379'),
	},

	// vault config
	vault: {
		address:	process.env.VAULT_ADDRESS ??
						(process.env.NODE_ENV === 'production'
							? 'https://vault:8200'
							: 'http://vault:8200'),
		token:		getVaultToken(),
	},

	// backend microservvices
	services: {
		authService:
			process.env.AUTH_SERVICE_URL ||
			(process.env.NODE_ENV === 'production'
				? 'https://auth:3001'
				: 'http://auth-service:3001'),
		userService:
			process.env.USER_SERVICE_URL ||
			(process.env.NODE_ENV === 'production'
				? 'https://user:3002'
				: 'http://user-service:3002'),
		gameService:
			process.env.GAME_SERVICE_URL ||
			(process.env.NODE_ENV === 'production'
				? 'https://game:3003'
				: 'http://game-service:3003'),
		gamificationService:
			process.env.GAMIFICATION_SERVICE_URL ||
			(process.env.NODE_ENV === 'production'
				? 'https://gamification:3004'
				: 'http://gamification-service:3004'),
	},

	// cors headers
	cors: {
		origin:	process.env.CORS_ORIGIN
					? process.env.CORS_ORIGIN
					: (process.env.NODE_ENV === 'production'
						? (() => {throw new Error('CORS_ORIGIN must be set in production');})()
						: '*'),
		credentials: true,
	},

	// ratelimit config
	rateLimit: {
		max:		parseInt(process.env.RATE_LIMIT_MAX || '100'),
		timeWindow:	process.env.RATE_LIMIT_WINDOW || '1 minute',
		ban:		parseInt(process.env.RATE_LIMIT_BAN || '10'),
	},

	// jwt secret env var
	security: {
		jwtSecret:	process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
	},
};

// if in prod and using default jwt secret, instafail
if (process.env.NODE_ENV === 'production' && config.security.jwtSecret === 'dev-jwt-secret-change-in-production') {
	throw new Error(
		"FATAL: JWT_SECRET is not set in production. Refusing to start with default secret."
	);
}

// log warning if using dev token in production
if (process.env.NODE_ENV === 'production' && config.vault.token === 'root_token_dev_only') {
	throw new Error(
		"FATAL: VAULT_TOKEN is using development default in production. Refusing to start with default token."
	);
}
