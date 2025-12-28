export const config = {
	port: parseInt(process.env.PORT || '3004'),
	host: process.env.HOST || '0.0.0.0',
	logLevel: (process.env.LOG_LEVEL || 'info') as 'info' | 'debug' | 'warn' | 'error',

	database: {
		host: process.env.DB_HOST || 'postgres',
		port: parseInt(process.env.DB_PORT || '5432'),
		user: process.env.DB_USER || 'root_admin',
		password: process.env.DB_PASSWORD || '',
		database: process.env.DB_NAME || 'game_db',
		ssl: process.env.NODE_ENV === 'production' ? {rejectUnauthorized: true} : false,
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

	gamification: {
		// xp required for each level (expo based)
		xpPerLevel: (level: number) => Math.floor(100 * Math.pow(1.5, level - 1)),
		// xp rewards for different actions
		xpRewards: {
			SESSION_COMPLETE: 100,
			SESSION_PERFECT: 250,
			ACHIEVEMENT_UNLOCK: 50,
			DAILY_LOGIN: 25,
			FIRST_SESSION: 500,
		},
		// TTL cache for leaderboard
		leaderboardCacheTTL: 300,
	},
};
