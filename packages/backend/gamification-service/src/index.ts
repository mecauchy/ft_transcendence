import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import {config} from './config';
import {xpRoutes} from './routes/xp';
import {achievementRoutes} from './routes/achievements';
import {leaderboardRoutes} from './routes/leaderboard';

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

		// healthcheck
		fastify.get('/health', async () => ({
			status: 'healthy',
			service: 'gamification-service',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		}));

		// REST Routes
		await fastify.register(xpRoutes, {prefix: '/api/gamification/xp'});
		await fastify.register(achievementRoutes, {prefix: '/api/gamification/achievements'});
		await fastify.register(leaderboardRoutes, {prefix: '/api/gamification/leaderboard'});

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
|Gamification Service - Speak Up Platform|

	Server:	${address}

	XP Endpoints:
		GET		/api/xp/me		- Get user XP summary
		GET		/api/xp/history	- Get XP history
		GET		/api/xp/daily	- Get daily XP breakdown
		POST	/api/xp/award	- Award XP (admin)

	Achievement Endpoints:
		GET	/api/achievements			- List all achievements
		GET	/api/achievements/me		- Get user's achievements
		GET	/api/achievements/:id		- Get achievement details
		GET	/api/achievements/progress	- Get progress

	Leaderboard Endpoints:
		GET	/api/leaderboard				- Global leaderboard
		GET	/api/leaderboard/friends		- Friends leaderboard
		GET	/api/leaderboard/scenario/:id	- Scenario leaderboard
		GET	/api/leaderboard/me				- User rank

	Database: ${config.database.host}:${config.database.port}
		`);
	} catch (err) {
		fastify.log.error(err, 'Failed to start gamification service');
		process.exit(1);
	}
}

// shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
	process.on(signal, async () => {
		fastify.log.info(`Received ${signal}, shutting down gracefully...`);
		await fastify.close();
		process.exit(0);
	});
});

start();
