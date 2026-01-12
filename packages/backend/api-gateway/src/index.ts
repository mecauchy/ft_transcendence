import Fastify, {FastifyRequest, FastifyReply} from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import proxy from '@fastify/http-proxy';
import websocket from '@fastify/websocket';
import fastifyCookie from '@fastify/cookie';
import session from '@fastify/session';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import {config} from './config';
import {VaultClient} from './vault/client';
import {authGuard, optionalAuth} from './middleware/auth';

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
	// disabled to avoid nullproxy crashes
	trustProxy: false,
	requestIdHeader: 'x-request-id',
	requestIdLogLabel: 'reqId',
});

// custom err handler to avoid null socket proxy response
fastify.setErrorHandler(
	(
		error:		Error &
		{statusCode?: number},
		request: FastifyRequest,
		reply: FastifyReply
	) => {
		// log error safely
		fastify.log.error({err: error, url: request.url, method: request.method}, 'Request error');

		// send error response
		if (!reply.sent) {
			reply.status(error.statusCode || 500).send({
				statusCode:	error.statusCode	|| 500,
				error:		error.name			|| 'Internal Server Error',
				message:	error.message		|| 'An unexpected error occurred',
			});
		}
	}
);

// setup infrastructure
async function	start() {
	// try to init redis client
	try {
		const redis = new Redis({
			host:			config.redis.host,
			port:			config.redis.port,
			password:		config.redis.password,
			retryStrategy:	(times: number) => Math.min(times * 50, 2000), // expo retry delays
		});

		redis.on('connect', () => {
			fastify.log.info('Connected to Redis server');
		});

		redis.on('error', (err: Error) => {
			fastify.log.error({error:		err}, 'Redis error occurred');
		});


		// init vault client
		const vaultConfig = {
			...config.vault,
			token:	config.vault.token,
		};
		const vault = new VaultClient(vaultConfig);
		await vault.init();

		// register cookies and middleware
		await fastify.register(fastifyCookie);
		await fastify.register(session, {
			secret: process.env.SESSION_SECRET || 'dev-session-secret-must-be-32-chars-long',
			cookie: {
				secure: process.env.NODE_ENV === 'production',
				httpOnly: true,
				sameSite: 'lax',
			},
		});

		// middleware init security headers
		await fastify.register(helmet, {
			contentSecurityPolicy: {
				directives: {
					defaultSrc:	["'self'"],
					styleSrc:	["'self'", "'unsafe-inline'"],
					scriptSrc:	["'self'"],
					imgSrc:		["'self'", 'data:', 'https:'],
					connectSrc:	["'self'", 'ws:', 'wss:'],
				},
			},
			hsts: {
				maxAge:				31536000,
				includeSubDomains:	true,
				preload:			true,
			},
		});

		// config CORS
		await fastify.register(cors, {
			origin:			config.cors.origin,
			methods:		['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
			allowedHeaders:	['Content-Type', 'Authorization', 'X-Request-ID'],
		});

		// config rate limiting
		await fastify.register(rateLimit, {
			max:				config.rateLimit.max,
			timeWindow:			config.rateLimit.timeWindow,
			redis:				redis as any,
			skipOnError:		false,
			continueExceeding:	true,
			enableDraftSpec:	true,
			cache:				10000,
			allowList:			['127.0.0.1'],
			// skip ratelimit for websocket and healthchecks
			skip: (request: FastifyRequest) => {
				const url = request.url || '';
				return url.includes('/ws/') || url.includes('/health');
			},
		} as any);

		// support websocket for gameservices
		await fastify.register(websocket, {
			options: {
				maxPayload:		1048576, // 1MB max ws payload
				verifyClient:	(info: any, next: (allow: boolean) => void) => {
					// JWT verification for websocket connections could be added here for enhanced security
					// Currently websocket auth is handled after connection via message-based auth
					next(true);
				},
			},
		});

		// healthcheck and monitoring
		fastify.get('/health', async () => {
			const vaultHealthy = await vault.isHealthy();
			const redisHealthy = redis.status === 'ready';

			return {
				status:		vaultHealthy && redisHealthy ? 'healthy' : 'degraded',
				timestamp:	new Date().toISOString(),
				services:	{
					redis:	redisHealthy,
					vault:	vaultHealthy,
				},
				uptime:		process.uptime(),
				memory:		process.memoryUsage(),
			};
		});

		// prometheus endpoint
		fastify.get('/metrics', async () => {
			return {
				// TODO: These metrics are placeholder values - implement actual tracking for production monitoring
				activeConnections:	0,
				totalRequests:		0,
				errorRates:			0,
				latency:			0,
			};
		});

		// auth service route
		await fastify.register(proxy, {
			upstream:		config.services.authService,
			prefix:			'/api/auth',
			rewritePrefix:	'/api/auth',
			http2:			false,
			preHandler: async (request: FastifyRequest) => {
				request.log.info(
					{path: request.url, method: request.method},
					'Proxying request to Auth Service'
				);
			},
		});

		// user service route
		await fastify.register(proxy, {
			upstream:		config.services.userService,
			prefix:			'/api/users',
			rewritePrefix:	'/api/users',
			http2:			false,
			preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
				await authGuard(request, reply);
				// if authguard sends response, stop here
				if (reply.sent)
					return;
				request.log.info(
					{path: request.url, method: request.method, userId: request.headers['x-user-id']},
					'Proxying authenticated request to User Service'
				);
			},
		});

		// uploads static files (avatars) - proxied to user-service
		await fastify.register(proxy, {
			upstream:		config.services.userService,
			prefix:			'/uploads',
			rewritePrefix:	'/uploads',
			http2:			false,
			preHandler: async (request: FastifyRequest) => {
				request.log.info(
					{path: request.url},
					'Proxying static upload request'
				);
			},
		});

		// game service route
		await fastify.register(proxy, {
			upstream:		config.services.gameService,
			prefix:			'/api/game',
			rewritePrefix:	'/api/game',
			http2:			false,
			preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
				await authGuard(request, reply);
				// if authguard sends response, stop here
				if (reply.sent)
					return;
				request.log.info(
					{path: request.url, method: request.method, userId: request.headers['x-user-id']},
					'Proxying authenticated request to Game Service'
				);
			},
		});

		// gamification service route
		await fastify.register(proxy, {
			upstream:		config.services.gamificationService,
			prefix:			'/api/gamification',
			rewritePrefix:	'/api/gamification',
			http2:			false,
			preHandler: async (request: FastifyRequest, reply: FastifyReply) => {
				await authGuard(request, reply);
				// if authguard sends response, stop here
				if (reply.sent)
					return;
				request.log.info(
					{path: request.url, method: request.method, userId: request.headers['x-user-id']},
					'Proxying authenticated request to Gamification Service'
				);
			},
		});

		// websocket route
		await fastify.register(async (fastify: {
				get: (
					arg0: string,
					arg1: {websocket: any;},
					arg2: (socket: any, request: FastifyRequest) => Promise<void>
				) => void;
			}) => {
				// store connected clients by uid
				const connectedClients = new Map<string, Set<any>>();

				fastify.get('/realtime', {websocket: true as any}, async (socket: any, request: FastifyRequest) => {
				const token = (request.query as any).token as string;

				request.log.info(
					{token: token ? '***' : 'missing', ip: request.ip},
					'New WebSocket connection for real-time features'
				);

				if (!token) {
					request.log.warn({ip: request.ip}, 'WebSocket connection rejected: missing token');
					socket.send(JSON.stringify({
						type:		'ERROR',
						code:		'AUTH_REQUIRED',
						message:	'Authentication token required. Pass ?token=<jwt> in query string.',
					}));
					socket.close(4001, 'Authentication required');
					return;
				}

				let userId:		string;
				let userRole:	string;

				try {
					const decoded = jwt.verify(token, config.security.jwtSecret, {
						algorithms:	['HS256'],
					}) as {
						userId:			string;
						role:			string;
						requires2FA?:	boolean;
						twoFAVerified?:	boolean};

					if (decoded.requires2FA && !decoded.twoFAVerified) {
						socket.send(JSON.stringify({
							type:		'ERROR',
							code:		'2FA_REQUIRED',
							message:	'2FA verification required before connecting.',
						}));
						socket.close(4003, '2FA required');
						return;
					}

					userId = decoded.userId;
					userRole = decoded.role;
					request.log.info({userId, role: userRole}, 'WebSocket real-time authenticated');

				} catch (err) {
					request.log.warn({ip: request.ip, error: (err as Error).message}, 'WebSocket auth failed');
					socket.send(JSON.stringify({
						type:		'ERROR',
						code:		'AUTH_FAILED',
						message:	'Invalid or expired token.',
					}));
					socket.close(4001, 'Authentication failed');
					return;
				}

				// add client to connected clients
				if (!connectedClients.has(userId)) {
					connectedClients.set(userId, new Set());
				}
				connectedClients.get(userId)!.add(socket);

				// subscribe to redis for realtime notifs
				// create new redis client for subscriptions
				const subscriber = new Redis({
					host: config.redis.host,
					port: config.redis.port,
					password: config.redis.password,
					retryStrategy: (times: number) => Math.min(times * 50, 2000),
				});

				// wait for client to be ready
				await new Promise<void>((resolve, reject) => {
					subscriber.once('ready', () => resolve());
					subscriber.once('error', (err: Error) => reject(err));
					setTimeout(() => reject(new Error('Redis subscriber connection timeout')), 5000);
				});

				await subscriber.subscribe(`user:${userId}:notifications`);
				await subscriber.subscribe(`user:${userId}:presence`);
				await subscriber.subscribe(`user:${userId}:messages`);
				await subscriber.subscribe('global:announcements');

				subscriber.on('message', (channel: string, message: string) => {
					try {
						const data = JSON.parse(message);

						if (data.type === 'NEW_MESSAGE') {
							socket.send(JSON.stringify({
								type: 'CHAT_MESSAGE',
								data: {
									messageId: data.data.id?.toString(),
									senderId: data.data.senderId?.toString(),
									content: data.data.content,
									conversationId: data.data.conversationId?.toString(),
									createdAt: data.data.createdAt,
								},
								timestamp: Date.now(),
							}));
						} else if (data.type === 'MESSAGES_READ') {
							socket.send(JSON.stringify({
								type: 'MESSAGES_READ',
								data: {
									conversationId: data.data.conversationId?.toString(),
									readByUserId: data.data.readByUserId?.toString(),
								},
								timestamp: Date.now(),
							}));
						} else {
							socket.send(JSON.stringify(data));
						}
					} catch {
						// ignores parse errors
					}
				});

				socket.on('message', async (message: any) => {
					try {
						const data = JSON.parse(message.toString());
						request.log.info({type: data.type, userId}, 'Received real-time message');

						// handle types
						switch (data.type) {
							case 'PING':
								socket.send(JSON.stringify({
									type: 'PONG',
									timestamp: Date.now(),
								}));
								break;

							case 'PRESENCE_UPDATE':
								// broadcast presence
								await redis.publish(`presence:${userId}`, JSON.stringify({
									type: 'PRESENCE_UPDATE',
									data: { userId, status: data.status || 'ONLINE' },
									timestamp: Date.now(),
								}));
								break;

							case 'TYPING':
								// broadcast typing state to recipient

								const typingData = data.data || data;
								if (typingData.recipientId && typingData.conversationId) {
									await redis.publish(`user:${typingData.recipientId}:messages`, JSON.stringify({
										type: 'TYPING',
										data: { userId, conversationId: typingData.conversationId },
										timestamp: Date.now(),
									}));
									request.log.info({userId, recipientId: typingData.recipientId}, 'Typing indicator sent');
								}
								break;
							default:
								socket.send(JSON.stringify({
									type: 'ACK',
									message: 'Message received',
									timestamp: Date.now(),
								}));
						}
					} catch (err: any) {
						request.log.error({error: err}, 'Failed to parse WebSocket message');
						socket.send(JSON.stringify({
							type: 'ERROR',
							message: 'Invalid message format',
							timestamp: Date.now(),
						}));
					}
				});

				socket.on('close', async () => {
					request.log.info({userId}, 'WebSocket real-time connection closed');
					
					// remove from connected clients
					connectedClients.get(userId)?.delete(socket);
					if (connectedClients.get(userId)?.size === 0) {
						connectedClients.delete(userId);
						// broadcast offline status
						await redis.publish(`presence:${userId}`, JSON.stringify({
							type: 'PRESENCE_UPDATE',
							data: { userId, status: 'OFFLINE' },
							timestamp: Date.now(),
						}));
					}
					
					// unsubscribe from redis
					await subscriber.unsubscribe();
					subscriber.disconnect();
				});

				socket.on('error', (err: any) => {
					request.log.error({error: err, userId}, 'WebSocket error occurred');
				});

				// keepalive pinging
				const pingInterval = setInterval(() => {
					if (socket.readyState === 1) { // OPEN
						socket.send(JSON.stringify({
							type: 'PING',
							timestamp: Date.now(),
						}));
					}
				}, 30000);

				// on close, clean ping interval
				socket.on('close', () => {
					clearInterval(pingInterval);
				});

				// send connected acknowledgment
				socket.send(JSON.stringify({
					type:		'CONNECTED',
					message:	'Connected to Speak-Up real-time service',
					userId,
					timestamp:	Date.now(),
				}));

				// broadcast online status
				await redis.publish(`presence:${userId}`, JSON.stringify({
					type: 'PRESENCE_UPDATE',
					data: { userId, status: 'ONLINE' },
					timestamp: Date.now(),
				}));
			});
		}, {prefix: '/api/ws'});

		// websocket route for investigation service
		await fastify.register(async (fastify: {
				get: (
					arg0: string,
					arg1: {websocket: any;},
					arg2: (socket: any, request: FastifyRequest) => Promise<void>
				) => void;
			}) => {
				fastify.get('/investigation', {websocket: true as any}, async (socket: any, request: FastifyRequest) => {
				const token = (request.query as any).token as string;

				// log new ws connection
				request.log.info(
					{token: token ? '***' : 'missing', ip: request.ip},
					'New WebSocket connection to Investigation Service'
				);

				// validate jwt tok from query params
				if (!token) {
					request.log.warn({ip: request.ip}, 'WebSocket connection rejected: missing token');
					socket.send(JSON.stringify({
						type:		'ERROR',
						code:		'AUTH_REQUIRED',
						message:	'Authentication token required. Pass ?token=<jwt> in query string.',
					}));
					socket.close(4001, 'Authentication required');
					return;
				}

				let userId:		string;
				let userRole:	string;

				// try verify jwt token
				try {
					const decoded = jwt.verify(token, config.security.jwtSecret, {
						algorithms:	['HS256'],
					}) as {
						userId:			string;
						role:			string;
						requires2FA?:	boolean;
						twoFAVerified?:	boolean};

					// check 2FA
					if (decoded.requires2FA && !decoded.twoFAVerified) {
						socket.send(JSON.stringify({
							type:		'ERROR',
							code:		'2FA_REQUIRED',
							message:	'2FA verification required before connecting.',
						}));
						socket.close(4003, '2FA required');
						return;
					}

					userId = decoded.userId;
					userRole = decoded.role;
					request.log.info({userId, role: userRole}, 'WebSocket authenticated');

				} catch (err) {
					// on token verify err, log to console
					request.log.warn({ip: request.ip, error:		(err as Error).message}, 'WebSocket auth failed');
					socket.send(JSON.stringify({
						type:		'ERROR',
						code:		'AUTH_FAILED',
						message:	'Invalid or expired token.',
					}));
					socket.close(4001, 'Authentication failed');
					return;
				}

				socket.on('message', async (message:	any) => {
					try {
						const data = JSON.parse(message.toString());
						request.log.info({type: data.type}, 'Received WebSocket message');

						// echo message back
						socket.send(
							JSON.stringify({
								type:		'ACK',
								message:	'Gateway received your message',
								timestamp:	Date.now(),
							})
						);
					} catch (err: any) {
						request.log.error({error:		err}, 'Failed to parse WebSocket message');
						socket.send(
							JSON.stringify({
								type:		'ERROR',
								message:	'Invalid message format',
								timestamp:	Date.now(),
							})
						);
					}
				});

				socket.on('close', () => {
					request.log.info('WebSocket connection closed');
				});

				socket.on('error', (err: any) => {
					request.log.error({error:		err}, 'WebSocket error occurred');
				});

				// send ack
				socket.send(
					JSON.stringify({
						type:		'CONNECTED',
						message:	'Welcome to Speak-Up Investigation Engine',
						timestamp:	Date.now(),
					})
				);
			});
		});

		// error handler
		fastify.setErrorHandler((error:		any, request: FastifyRequest) => {
			request.log.error({error}, 'Unhandled error occurred');

			if (error?.statusCode === 429) {
				return {
					statusCode:	429,
					error:		'Too Many Requests',
					message:	'You have exceeded your request rate limit.',
				};
			}

			return {
				statusCode:	error?.statusCode	|| 500,
				error:		error?.name			|| 'Internal Server Error',
				message:	error?.message		|| 'An unexpected error occurred.',
				requestId:	request.id,
			};
		});

		// finally, start the server
		const address = await fastify.listen({
			host:	config.host,
			port:	config.port,
		});

		fastify.log.info(`
|API Gateway - Speak Up Platform|
	Server:	${address}

	Routes:
		/api/auth/*			${config.services.authService}			(public)
		/api/users/*			${config.services.userService}		(protected)
		/api/game/*			${config.services.gameService}			(protected)
		/api/gamification/*	${config.services.gamificationService}	(protected)
		/investigation		WebSocket (token required)

	Security:
		AuthGuard	(JWT verification at gateway)
		Helmet		(CSP, HSTS)
		CORS		enabled
		Rate limit	(${config.rateLimit.max} req/${config.rateLimit.timeWindow})

	Infrastructure:
		Redis:	${config.redis.host}:${config.redis.port}
		Vault:	${config.vault.address}
	Monitoring:
		/health
		/metrics

	Logs at level:	${config.logLevel}
	`);

	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		fastify.log.error({error:		{message:	error.message, stack: error.stack, name: error.name}}, 'Error starting server');
		console.error('Full error:', err);
		process.exit(1);
	}
}

// shutdown from sigint/sigterm
const signals = ['SIGINT', 'SIGTERM'];

signals.forEach((signal) => {
	process.on(signal, async () => {
		fastify.log.info(`Received ${signal}, shutting down gracefully...`);
		await fastify.close();
		fastify.log.info('Server closed. Exiting process.');
		process.exit(0);
	});
});

// start the server
start();
