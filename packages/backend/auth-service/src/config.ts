export const config = {
	port:		parseInt(process.env.PORT	|| '3001'),
	host:		process.env.HOST			|| '0.0.0.0',
	logLevel:	(process.env.LOG_LEVEL		|| 'info') as 'info' | 'debug' | 'warn' | 'error',

	database: {
		host:		process.env.DB_HOST				|| 'postgres',
		port:		parseInt(process.env.DB_PORT	|| '5432'),
		user:		process.env.DB_USER				|| 'root_admin',
		password:	process.env.DB_PASSWORD			|| '',
		database:	process.env.DB_NAME				|| 'auth_db',
		ssl:		process.env.NODE_ENV === 'production'
						? {rejectUnauthorized: true}
						: false,
	},

	redis: {
		host:	process.env.REDIS_HOST			|| 'redis',
		port:	parseInt(process.env.REDIS_PORT	|| '6379'),
	},

	vault: {
		address:	process.env.VAULT_ADDR	|| 'http://vault:8200',
		token:		process.env.VAULT_TOKEN	|| '',
	},

	oauth: {
		clientId:			process.env.OAUTH_42_CLIENT_ID		|| '',
		clientSecret:		process.env.OAUTH_42_CLIENT_SECRET	|| '',
		redirectUri:		process.env.OAUTH_42_REDIRECT_URI	|| 'http://localhost:3000/api/auth/callback/42',
		authorizationUrl:	'https://api.intra.42.fr/oauth/authorize',
		tokenUrl:			'https://api.intra.42.fr/oauth/token',
		userInfoUrl:		'https://api.intra.42.fr/v2/me',
	},

	jwt: {
		secret:				process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
		accessTokenExpiry:	'15m' as const,
		refreshTokenExpiry:	'7d' as const,
		issuer:				'speak-up-auth',
	},

	cors: {
		origin:	process.env.CORS_ORIGIN || '*',
	},
};

// validation for production
if (process.env.NODE_ENV === 'production') {
	if (config.jwt.secret === 'dev-jwt-secret-change-in-production') {
		throw new Error('JWT_SECRET must be set in production');
	}
	if (!config.oauth.clientId || !config.oauth.clientSecret) {
		throw new Error('OAuth credentials must be set in production');
	}
}
