// packages/backend/api-gateway/src/index.ts

import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import proxy from '@fastify/http-proxy';
import websocket from '@fastify/websocket';
import fastifyCookie from '@fastify/cookie';
import session from '@fastify/session';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { config } from './config';
import { VaultClient } from './vault/client';
import { authGuard, optionalAuth } from './middleware/auth';

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
	trustProxy: false, // Disabled temporarily to avoid null socket crash in proxy responses
	requestIdHeader: 'x-request-id',
	requestIdLogLabel: 'reqId',
});

// Custom error handler to prevent crashes when socket is null during proxy responses
fastify.setErrorHandler((error: Error & { statusCode?: number }, request: FastifyRequest, reply: FastifyReply) => {
	// Safely log the error without accessing potentially null socket properties
	fastify.log.error({ err: error, url: request.url, method: request.method }, 'Request error');
	
	// Send error response if not already sent
	if (!reply.sent) {
		reply.status(error.statusCode || 500).send({
			statusCode: error.statusCode || 500,
			error: error.name || 'Internal Server Error',
			message: error.message || 'An unexpected error occurred',
		});
	}
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
			retryStrategy: (times: number) => Math.min(times * 50, 2000), // Exponential backoff for retries
		});

		redis.on('connect', () => {
			fastify.log.info('Connected to Redis server');
		});

		redis.on('error', (err: Error) => {
			fastify.log.error({ error: err }, 'Redis error occurred');
		});


		// Vault client for secret management
		const vaultConfig = {
			...config.vault,
			token: config.vault.token,
		};
		const vault = new VaultClient(vaultConfig);
		await vault.authenticate();

		// Register cookie and session middleware
		// Note: add dependencies '@fastify/cookie' and '@fastify/session' to package.json
		await fastify.register(fastifyCookie);
		await fastify.register(session, {
			secret: process.env.SESSION_SECRET || 'dev-session-secret-must-be-32-chars-long',
			cookie: {
				secure: process.env.NODE_ENV === 'production',
				httpOnly: true,
				sameSite: 'lax',
			},
		});
		
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
		});

		// =====================================================
		// ROUTE: USER SERVICE (/api/users/*) - PROTECTED
		// =====================================================
		await fastify.register(proxy, {
			upstream: config.services.userService,
			prefix: '/api/users',
			rewritePrefix: '/api/users',
			http2: false,
			preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
				await authGuard(request, reply);
				if (reply.sent) return; // Stop if authGuard sent a response
				request.log.info(
					{ path: request.url, method: request.method, userId: request.headers['x-user-id'] },
					'Proxying authenticated request to User Service'
				);
			},
		});

		// =====================================================
		// ROUTE: GAME SERVICE (/api/game/*) - PROTECTED
		// =====================================================
		await fastify.register(proxy, {
			upstream: config.services.gameService,
			prefix: '/api/game',
			rewritePrefix: '/api/game',
			http2: false,
			preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
				await authGuard(request, reply);
				if (reply.sent) return;
				request.log.info(
					{ path: request.url, method: request.method, userId: request.headers['x-user-id'] },
					'Proxying authenticated request to Game Service'
				);
			},
		});

		// =====================================================
		// ROUTE: GAMIFICATION SERVICE (/api/gamification/*) - PROTECTED
		// =====================================================
		await fastify.register(proxy, {
			upstream: config.services.gamificationService,
			prefix: '/api/gamification',
			rewritePrefix: '/api/gamification',
			http2: false,
			preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
				await authGuard(request, reply);
				if (reply.sent) return;
				request.log.info(
					{ path: request.url, method: request.method, userId: request.headers['x-user-id'] },
					'Proxying authenticated request to Gamification Service'
				);
			},
		});

		// =====================================================
		// ROUTE: WEBSOCKET - INVESTIGATION (PROTECTED)
		// =====================================================
		await fastify.register(async (fastify: { get: (arg0: string, arg1: { websocket: any; }, arg2: (connection: any, request: FastifyRequest) => Promise<void>) => void; }) => {
			fastify.get('/investigation', { websocket: true as any }, async (connection: any, request: FastifyRequest) => {
				const token = (request.query as any).token as string;

				request.log.info(
					{ token: token ? '***' : 'missing', ip: request.ip },
					'New WebSocket connection to Investigation Service'
				);

				// Validate JWT token from query params
				if (!token) {
					request.log.warn({ ip: request.ip }, 'WebSocket connection rejected: missing token');
					connection.socket.send(JSON.stringify({
						type: 'ERROR',
						code: 'AUTH_REQUIRED',
						message: 'Authentication token required. Pass ?token=<jwt> in query string.',
					}));
					connection.socket.close(4001, 'Authentication required');
					return;
				}

				let userId: string;
				let userRole: string;

				try {
					const decoded = jwt.verify(token, config.security.jwtSecret, {
						algorithms: ['HS256'],
					}) as { userId: string; role: string; requires2FA?: boolean; twoFAVerified?: boolean };

					// Check 2FA
					if (decoded.requires2FA && !decoded.twoFAVerified) {
						connection.socket.send(JSON.stringify({
							type: 'ERROR',
							code: '2FA_REQUIRED',
							message: '2FA verification required before connecting.',
						}));
						connection.socket.close(4003, '2FA required');
						return;
					}

					userId = decoded.userId;
					userRole = decoded.role;
					request.log.info({ userId, role: userRole }, 'WebSocket authenticated');

				} catch (err) {
					request.log.warn({ ip: request.ip, error: (err as Error).message }, 'WebSocket auth failed');
					connection.socket.send(JSON.stringify({
						type: 'ERROR',
						code: 'AUTH_FAILED',
						message: 'Invalid or expired token.',
					}));
					connection.socket.close(4001, 'Authentication failed');
					return;
				}

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
				});

				// Send initial ACK
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
     /api/auth/*         → ${config.services.authService} (public)
     /api/users/*        → ${config.services.userService} (🔒 protected)
     /api/game/*         → ${config.services.gameService} (🔒 protected)
     /api/gamification/* → ${config.services.gamificationService} (🔒 protected)
     /investigation      → WebSocket (🔒 token required)
  
  🔒 Security:
     ✓ AuthGuard (JWT verification at gateway)
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
		fastify.log.error({ error: { message: error.message, stack: error.stack, name: error.name } }, 'Error starting server');
		console.error('Full error:', err);
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
