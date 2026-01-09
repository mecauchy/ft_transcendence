import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import {config} from './config';
import {authRoutes} from './routes/auth';
import {twoFactorRoutes} from './routes/2fa';

const fastify = Fastify({
	logger: {
		level:		config.logLevel,
		transport: {
			target:	'pino-pretty',
			options: {
				colorize:		true,
				translateTime:	'HH:MM:ss Z',
				ignore:			'pid,hostname',
			},
		},
	},
});

async function start() {
	try {
		// cors security middleware
		await fastify.register(helmet);
		await fastify.register(cors, {
			origin:			config.cors.origin,
			credentials:	true,
		});

		// health check
		fastify.get('/health', async () => ({
			status:		'healthy',
			service:	'auth-service',
			timestamp:	new Date().toISOString(),
			uptime:		process.uptime(),
		}));

		// register routes
		await fastify.register(authRoutes, {prefix: '/api/auth'});
		await fastify.register(twoFactorRoutes, {prefix: '/api/auth/2fa'});

		// error handler
		fastify.setErrorHandler((error:		Error & {statusCode?: number}, request, reply) => {
			request.log.error({error}, 'Unhandled error');

			const statusCode = error.statusCode || 500;
			reply.status(statusCode).send({
				statusCode,
				error:		error.name		|| 'Internal Server Error',
				message:	error.message	|| 'An unexpected error occurred',
			});
		});

		// start server
		const address = await fastify.listen({
			port:	config.port,
			host:	config.host,
		});

		fastify.log.info(`
|Auth Service - Speak Up Platform|
	Server:	${address}

	Endpoints:
		POST /api/auth/login/42		- OAuth login with 42 API
		POST /api/auth/refresh		- Refresh access token
		POST /api/auth/logout		- Invalidate session
		POST /api/auth/2fa/setup	- Enable 2FA
		POST /api/auth/2fa/verify	- Verify 2FA code
		POST /api/auth/2fa/disable	- Disable 2FA

	Database:	${config.database.host}:${config.database.port}
	Vault:		${config.vault.address}
		`);

	} catch (err) {
		fastify.log.error(err, 'Failed to start auth service');
		process.exit(1);
	}
}

// shutdown without breaking
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
	process.on(signal, async () => {
		fastify.log.info(`Received ${signal}, shutting down gracefully...`);
		await fastify.close();
		process.exit(0);
	});
});

// start the server
start();
