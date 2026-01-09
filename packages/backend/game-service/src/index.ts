import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import {config} from './config';
import {gameRoutes} from './routes/game';


// FUTURE: UNUSED FUNCTIONAILITIES -> uncomment for developing after transcendence
// 
// import websocket from '@fastify/websocket';
// import {sessionRoutes, setWebSocketManager} from './routes/session';
// import {scenarioRoutes} from './routes/scenarios';
// import {WebSocketManager} from './websocket/manager';
// const wsManager = new WebSocketManager();
// setWebSocketManager(wsManager);

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

async function start() {
	try {
		// security middleware
		await fastify.register(helmet);
		await fastify.register(cors, {
			origin: config.cors.origin,
			credentials: true,
		});

		// FUTURE: UNUSED FUNCTIONAILITIES -> uncomment for developing after transcendence
		//
		// await fastify.register(websocket, {
		// 	options: {
		// 		maxPayload: 1048576, // 1mb max
		// 	},
		// });

		// healthcheck
		fastify.get('/health', async () => ({
			status: 'healthy',
			service: 'game-service',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		}));

		// REST routes - Active game endpoints (Pong, Breathe)
		await fastify.register(gameRoutes, {prefix: '/api/game'});

		// FUTURE: UNUSED FUNCTIONAILITIES -> uncomment for developing after transcendence
		//
		// await fastify.register(sessionRoutes, {prefix: '/api/game/session'});
		// await fastify.register(scenarioRoutes, {prefix: '/api/game/scenarios'});
		//
		// // WebSocket route for game connections
		// fastify.get('/ws/game', {websocket: true}, (socket, request) => {
		// 	wsManager.handleConnection(socket, request);
		// });

		// handle errors
		fastify.setErrorHandler((error: Error & {statusCode?: number}, request, reply) => {
			request.log.error({error}, 'Unhandled error');

			const statusCode = error.statusCode || 500;
			reply.status(statusCode).send({
				statusCode,
				error: error.name || 'Internal Server Error',
				message: error.message || 'An unexpected error occurred',
			});
		});

		// start server
		const address = await fastify.listen({
			port: config.port,
			host: config.host,
		});

		fastify.log.info(`
|Game Service - Speak Up Platform|
	Server: ${address}

	REST Endpoints:
		POST	/api/game/pong/match           - Save pong match stats
		POST	/api/game/breathe              - Save breathe session stats
		GET	/api/game/pong/history         - Get pong match history
		GET	/api/game/breathe/history      - Get breathe session history
		GET	/api/game/breathe/history/:id  - Get breathe history for user

	Database: ${config.database.host}:${config.database.port}
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
		// FUTURE: wsManager.shutdown();
		await fastify.close();
		process.exit(0);
	});
});

start();
