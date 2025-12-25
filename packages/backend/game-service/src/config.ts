export const config = {
	port: parseInt(process.env.PORT || '3003'),
	host: process.env.HOST || '0.0.0.0',
	logLevel: (process.env.LOG_LEVEL || 'info') as 'info' | 'debug' | 'warn' | 'error',

	database: {
		host: process.env.DB_HOST || 'postgres',
		port: parseInt(process.env.DB_PORT || '5432'),
		user: process.env.DB_USER || 'root_admin',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_NAME || 'game_db',
		ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
	},

	redis: {
		host: process.env.REDIS_HOST || 'redis',
		port: parseInt(process.env.REDIS_PORT || '6379'),
	},

	jwt: {
		secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
		issuer: 'speak-up-auth',
	},

	cors: {
		origin: process.env.CORS_ORIGIN || '*',
	},

	game: {
		tickRate: parseInt(process.env.GAME_TICK_RATE || '20'), // 20 ticks per second
		maxPlayersPerSession: 2,
		maxSpectatorsPerSession: 50,
		sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '3600000'), // 1 hour
		reconnectWindow: parseInt(process.env.RECONNECT_WINDOW || '30000'), // 30 seconds
	},
};
