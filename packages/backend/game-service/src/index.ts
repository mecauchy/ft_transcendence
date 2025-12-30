import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import {config} from './config';
import {sessionRoutes, setWebSocketManager} from './routes/session';
import {scenarioRoutes} from './routes/scenarios';
import {WebSocketManager} from './websocket/manager';

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
});

// websocket manager instance
const wsManager = new WebSocketManager();

// inject into session routes
setWebSocketManager(wsManager);

async function start() {
	try {
		// security middleware
		await fastify.register(helmet);
		await fastify.register(cors, {
			origin: config.cors.origin,
			credentials: true,
		});

		// ws support
		await fastify.register(websocket, {
			options: {
				maxPayload: 1048576, // 1mb max
			},
		});

		// healthcheck
		fastify.get('/health', async () => ({
			status: 'healthy',
			service: 'game-service',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
			activeSessions: wsManager.getActiveSessionCount(),
		}));

		// REST routes
		await fastify.register(sessionRoutes, {prefix: '/api/game/session'});
		await fastify.register(scenarioRoutes, {prefix: '/api/game/scenarios'});

		// webscoket route for game connections
		fastify.get('/ws/game', {websocket: true}, (socket, request) => {
			wsManager.handleConnection(socket, request);
		});

		// handle errors
		fastify.setErrorHandler((error:		Error & {statusCode?: number}, request, reply) => {
			request.log.error({error}, 'Unhandled error');

			const statusCode = error.statusCode || 500;
			reply.status(statusCode).send({
				statusCode,
				error:		error.name || 'Internal Server Error',
				message:	error.message || 'An unexpected error occurred',
			});
		});

		// start server
		const address = await fastify.listen({
			port: config.port,
			host: config.host,
		});

		fastify.log.info(`
|Game Service - Speak Up Platform|
	Server:	${address}

	REST Endpoints:
		POST	/api/game/pong				- Save pong game stats
		POST	/api/game/breathe			- Save the breathe session stats
		POST	/api/session/start			- Start new session
		GET		/api/session/:id			- Get session state
		GET		/api/session/:id/history	- Get session event history
		POST	/api/session/:id/surrender	- End session
		GET		/api/scenarios				- List available scenarios
		GET		/api/scenarios/:id			- Get scenario details

	WebSocket:
		/ws/game?token=<jwt>&sessionId=<id>

	Database: ${config.database.host}:${config.database.port}
	Active Sessions: ${wsManager.getActiveSessionCount()}
		`);

	} catch (err) {
		fastify.log.error(err, 'Failed to start game service');
		process.exit(1);
	}
}

// shutdown sig
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
	process.on(signal, async () => {
		fastify.log.info(`Received ${signal}, shutting down gracefully...`);
		wsManager.shutdown();
		await fastify.close();
		process.exit(0);
	});
});

start();
