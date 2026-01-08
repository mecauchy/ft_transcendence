// packages/backend/api-gateway/src/config.ts
import * as fs from 'fs';

// Helper function to get secrets from environment or file
function getSecret(envVar: string, fileEnvVar: string, required: boolean = true): string | undefined {
  // Check environment variable first
  if (process.env[envVar]) {
    return process.env[envVar];
  }
  
  // Check file path from environment
  const filePath = process.env[fileEnvVar];
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8').trim();
  }
  
  if (required && process.env.NODE_ENV === 'production') {
    throw new Error(`Required secret ${envVar} not found`);
  }
  
  return undefined;
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  logLevel: (process.env.LOG_LEVEL || 'info') as 'info' | 'debug' | 'warn' | 'error',

  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD, // Set by entrypoint.sh from /run/secrets
  },

  vault: {
    address:
      process.env.VAULT_ADDRESS ??
      (process.env.NODE_ENV === 'production' ? 'https://vault:8200' : 'http://vault:8200'),
      token: process.env.VAULT_TOKEN || 'root_token_dev_only',
  },

  services: {
    authService:
      process.env.AUTH_SERVICE_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'http://auth-service:3001'
        : 'http://auth-service:3001'),
    userService:
      process.env.USER_SERVICE_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'http://user-service:3002'
        : 'http://user-service:3002'),
    gameService:
      process.env.GAME_SERVICE_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'http://game-service:3003'
        : 'http://game-service:3003'),
  },

  cors: {
    origin:
      process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN
        : (process.env.NODE_ENV === 'production'
            ? (() => { throw new Error('CORS_ORIGIN must be set in production'); })()
            : '*'),
    credentials: true,
  },

  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // requests per window
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    ban: parseInt(process.env.RATE_LIMIT_BAN || '10'), // ban after violations
  },

  session: {
    // Session secret must be at least 32 characters
    secret: getSecret('SESSION_SECRET', 'SESSION_SECRET_FILE', false) || 
      'dev-session-secret-minimum-32-characters-long',
  },

  security: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  },
};

// Fail fast if using the default JWT secret in production
if (
  process.env.NODE_ENV === 'production' &&
  config.security.jwtSecret === 'dev-secret-change-in-production'
) {
  throw new Error(
    "FATAL: JWT_SECRET is not set in production. Refusing to start with default secret."
  );
}

// Log warning if using development Vault token
if (
  process.env.NODE_ENV === 'production' &&
  config.vault.token === 'root_token_dev_only'
) {
  throw new Error(
    "FATAL: VAULT_TOKEN is using development default in production. Refusing to start with default token."
  );
}
