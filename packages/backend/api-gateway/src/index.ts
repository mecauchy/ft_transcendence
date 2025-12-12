// packages/backend/api-gateway/src/index.ts

import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
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

		redis.on('error', (err: Error) => {
			fastify.log.error({ error: err }, 'Redis error occurred');
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
					connectSrc: ["'self'", 'ws:', 'wss:'],
				},
			},
			hsts: {
				maxAge: 31536000,
				includeSubDomains: true,
				preload: true,
			},
		});

		// CORS configuration
		await fastify.register( cors, {
			origin: config.cors.origin,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
			allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
		});

		// Rate limiting with token bucket algorithm for DDoS protection
		await fastify.register( rateLimit, {
			max: config.rateLimit.max,
			timeWindow: config.rateLimit.timeWindow,
			redis: redis as any,
			skipOnError: false,
			continueExceeding: true,
			enableDraftSpec: true,
			cache: 10000,
			allowList: ['127.0.0.1'],
		} as any);

		// WebSocket support for game services
		await fastify.register(websocket, {
			options: {
				maxPayload: 1048576, // 1 MB
				verifyClient: (info: any, next: (allow: boolean) => void) => {
					// TODO: verify JWT token from query params or headers or cookies
					next(true);
				},
			},
		});

		// =====================================================
		// HEALTH CHECK & MONITORING
		// =====================================================
		fastify.get('/health', async () => {
			const vaultHealthy = await vault.isHealthy();
			const redisHealthy = redis.status === 'ready';

			return {
				status: vaultHealthy && redisHealthy ? 'healthy' : 'degraded',
				timestamp: new Date().toISOString(),
				services: {
					redis: redisHealthy,
					vault: vaultHealthy,
				},
				uptime: process.uptime(),
				memory: process.memoryUsage(),
			};
		});

		// Prometheus metrics endpoint
		fastify.get('/metrics', async () => {
			return {
				activeConnections: 0, // TODO: track from redis
				totalRequests: 0, // TODO: implement counter
				errorRates: 0, // TODO: implement error tracking
				latency: 0, // TODO: implement latency tracking
			};
		});

		// =====================================================
		// ROUTE: AUTH SERVICE (/api/auth/*)
		// =====================================================
		await fastify.register( proxy, {
			upstream: config.services.authService,
			prefix: '/api/auth',
			rewritePrefix: '/api/auth',
			http2: false,
			preHandler: async (request: FastifyRequest) => {
				request.log.info(
					{ path: request.url, method: request.method },
					'Proxying request to Auth Service'
				);
			},
			replyOptions: {
				rewriteHeaders: (originalReq: any, headers: any) => ({
					...headers,
					'x-forwarded-for': originalReq.ip,
					'x-request-id': originalReq.id,
				}),
			},
		});

		// =====================================================
		// ROUTE: USER SERVICE (/api/users/*)
		// =====================================================
		await fastify.register( proxy, {
			upstream: config.services.userService,
			prefix: '/api/users',
			rewritePrefix: '/api/users',
			http2: false,
			preHandler: async (request: FastifyRequest) => {
				// TODO: validate JWT token before proxying from Authorization header
				request.log.info(
					{ path: request.url, method: request.method },
					'Proxying request to User Service'
				);
			},
		});

		// =====================================================
		// ROUTE: GAME/INVESTIGATION ENDPOINTS
		// =====================================================
		await fastify.register(async (fastify) => {
			fastify.get('/investigation', { websocket: true as any }, async (connection: any, request: FastifyRequest) => {
				const token = (request.query as any).token as string;

				request.log.info(
					{ token: token ? '***' : 'missing', ip: request.ip },
					'New WebSocket connection to Investigation Service'
				);

				// TODO: Validate JWT token
				// TODO: Extract userId and sessionId from token
				// TODO: Forward Websocket to game service

				connection.socket.on('message', async (message: any) => {
					try {
						const data = JSON.parse(message.toString());
						request.log.info({ type: data.type }, 'Received WebSocket message');

						// Placeholder: Echo message back
						connection.socket.send(
							JSON.stringify({
								type: 'ACK',
								message: 'Gateway received your message',
								timestamp: Date.now(),
							})
						);
					} catch (err: any) {
						request.log.error({ error: err }, 'Failed to parse WebSocket message');
						connection.socket.send(
							JSON.stringify({
								type: 'ERROR',
								message: 'Invalid message format',
								timestamp: Date.now(),
							})
						);
					}
				});

				connection.socket.on('close', () => {
					request.log.info('WebSocket connection closed');
				});

			connection.socket.on('error', (err: any) => {
				request.log.error({ error: err }, 'WebSocket error occurred');
			});				// Send initial ACK
				connection.socket.send(
					JSON.stringify({
						type: 'CONNECTED',
						message: 'Welcome to Speak-Up Investigation Engine',
						timestamp: Date.now(),
					})
				);
			});
		});

		// =====================================================
		// ERROR HANDLING
		// =====================================================
		fastify.setErrorHandler((error: any, request: FastifyRequest) => {
			request.log.error({ error }, 'Unhandled error occurred');

			if (error?.statusCode === 429) {
				return {
					statusCode: 429,
					error: 'Too Many Requests',
					message: 'You have exceeded your request rate limit.',
				};
			}

			return {
				statusCode: error?.statusCode || 500,
				error: error?.name || 'Internal Server Error',
				message: error?.message || 'An unexpected error occurred.',
				requestId: request.id,
			};
		});

		// =====================================================
		// START THE SERVER
		// =====================================================
		const address = await fastify.listen({
			host: config.host,
			port: config.port,
		});

		fastify.log.info(`
╔════════════════════════════════════════════════════════════╗
║           API Gateway - Speak Up Platform                  ║
╚════════════════════════════════════════════════════════════╝

  🚀 Server:        ${address}
  
  📡 Routes:
	 /api/auth/*    → ${config.services.authService}
	 /api/users/*   → ${config.services.userService}
	 /api/session/* → ${config.services.gameService}
	 /investigation (WebSocket)
  
  🔒 Security:
	 ✓ Helmet (CSP, HSTS)
	 ✓ CORS enabled
	 ✓ Rate limiting (${config.rateLimit.max} req/${config.rateLimit.timeWindow})
  
  💾 Infrastructure:
	 Redis:  ${config.redis.host}:${config.redis.port}
	 Vault:  ${config.vault.address}

  📊 Monitoring:	 
	 /health
	 /metrics
	 
  Logs at level: ${config.logLevel}
	`);

	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		fastify.log.error({ error }, 'Error starting server');
		process.exit(1);
	}
}

// ====================================================
// GRACEFUL SHUTDOWN
// ====================================================
const signals = ['SIGINT', 'SIGTERM'];

signals.forEach((signal) => {
	process.on(signal, async () => {
		fastify.log.info(`Received ${signal}, shutting down gracefully...`);
		await fastify.close();
		fastify.log.info('Server closed. Exiting process.');
		process.exit(0);
	});
});

// Start the server
start();
