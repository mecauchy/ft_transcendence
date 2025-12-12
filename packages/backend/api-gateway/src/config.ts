// packages/backend/api-gateway/src/config.ts
export const config = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  logLevel: (process.env.LOG_LEVEL || 'info') as 'info' | 'debug' | 'warn' | 'error',
  
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },

  vault: {
    address: process.env.VAULT_ADDR || 'http://vault:8200',
    token: process.env.VAULT_TOKEN || 'root_token_dev_only', // Dev only!
  },

  services: {
    authService: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
    userService: process.env.USER_SERVICE_URL || 'http://user-service:3002',
    gameService: process.env.GAME_SERVICE_URL || 'http://game-service:3003',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*', // Must be specific in production
    credentials: true,
  },

  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // requests per window
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    ban: parseInt(process.env.RATE_LIMIT_BAN || '10'), // ban after violations
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  },
};
