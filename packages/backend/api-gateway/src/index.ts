// packages/backend/api-gateway/src/index.ts

import Fastify, { FastifyRequest } from 'fastify';
import helmet from '@fastify-helmet';
import cors from '@fastify-cors';
import rateLimit from '@fastify-rate-limit';
import proxy from '@fastify/http-proxy';
import websocket from '@fastify/websocket';
import Redis from 'ioredis';
import { config } from './config';
import { VaultClient } from './vault/client';

// Import shared contracts for type safety
import type {
	IAuthResponse,
	IUserProfile,
	ISessionStartRequest,
	ISessionStartResponse,
} from '@speak-up/shared';

const fastify = Fastify({
	logger: {
		level: config.logLevel,
		transport: {
			target: 'pino-pretty',
			options: {
				colorize: true,
				translateTime: 'HH:MM:ss Z',
				ignore: 'pid,hostname',
			},
		},
	},
	trustProxy: true,
	requestIdHeader: 'x-request-id',
	requestIdLogLabel: 'reqId',
});

// =====================================================
// INFRASTRUCTURE SETUP
// =====================================================
async function start() {
	try {

		// Initialize redis client for rate limiting and presence tracking
		const redis = new Redis({
			host: config.redis.host,
			port: config.redis.port,
			retryStrategy: (times) => Math.min(times * 50, 2000), // Exponential backoff for retries
		});

		redis.on('connect', () => {
			fastify.log.info('Connected to Redis server');
		});

		redis.on('error', (err) => {
			fastify.log.error('Redis error:', err);
		});


		// Vault client for secret management
		const vault = new VaultClient(config.vault);
		await vault.authenticate();
		
		// =====================================================
		// MIDDLEWARE
		// =====================================================

		// Helmet for security headers
		await fastify.register(helmet, {
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'self'"],
					styleSrc: ["'self'", "'unsafe-inline'"],
					scriptSrc: ["'self'"],
					imgSrc: ["'self'", 'data:', 'https:'],
				}
			}
		});

	} catch (err) {
		fastify.log.error('Error starting server:', err);
		process.exit(1);
	}
}
