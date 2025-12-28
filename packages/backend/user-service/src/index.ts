import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import {config} from './config';
import {profileRoutes} from './routes/profile';
import {friendsRoutes} from './routes/friends';
import {gdprRoutes} from './routes/gdpr';
import {settingsRoutes} from './routes/settings';

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
		// middleware security
		await fastify.register(helmet);
		await fastify.register(cors, {
			origin: config.cors.origin,
			credentials: true,
		});

		// support file uploading
		await fastify.register(multipart, {
			limits: {
				fileSize: config.upload.maxFileSize,
			},
		});

		// healthcheck
		fastify.get('/health', async () => ({
			status: 'healthy',
			service: 'user-service',
			timestamp: new Date().toISOString(),
			uptime: process.uptime(),
		}));

		// register routes
		await fastify.register(profileRoutes, {prefix: '/api/users'});
		await fastify.register(friendsRoutes, {prefix: '/api/users/friends'});
		await fastify.register(gdprRoutes, {prefix: '/api/users/gdpr'});
		await fastify.register(settingsRoutes, {prefix: '/api/users/settings'});

		// error handler
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
|User Service - Speak Up Platform|
Server:	${address}

Endpoints:
GET		/api/users/me			- Get current user profile
PUT		/api/users/me			- Update profile
PUT		/api/users/me/avatar	- Upload avatar
GET		/api/users/friends		- List friends
POST	/api/users/friends		- Send friend request
PUT		/api/users/friends/:id	- Accept/reject request
DELETE	/api/users/friends/:id	- Remove friend
GET		/api/users/gdpr/export	- Export user data (GDPR)
DELETE	/api/users/gdpr/delete	- Delete account (GDPR)

Database: ${config.database.host}:${config.database.port}
		`);

	} catch (err) {
		fastify.log.error(err, 'Failed to start user service');
		process.exit(1);
	}
}

//shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
	process.on(signal, async () => {
		fastify.log.info(`Received ${signal}, shutting down gracefully...`);
		await fastify.close();
		process.exit(0);
	});
});

start();
