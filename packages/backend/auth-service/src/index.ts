import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { IAuthResponse } from '../../../shared/types/auth'; // importing the contract
import { UserRole } from '../../../shared/types/user'; // importing enum for user roles

const fastify = Fastify({ logger: false });

console.log('Auth service starting...');

// example route adhering to the contract
import JwtService from './jwt.service';

fastify.post<{ Reply: IAuthResponse }>('/auth/token', async (request: FastifyRequest, reply: FastifyReply) => {
	// NOTE: This route is a simplified example. Replace the authentication
	// checks below with your actual credential validation (passwords, 42 OAuth, etc.).

	// Accept username/userId from body for demo; default to a test user.
	const body = (request.body as any) || {};
	const userId = body.userId || '1';
	const username = body.username || 'dev_user';

	// Sign an access token (15m expiry)
	const accessToken = JwtService.signToken(userId, username);

	const response: IAuthResponse = {
		accessToken,
		refreshToken: 'refreshTokenPlaceholder', // implement refresh token flow separately
		require2FA: false,
		user: {
			id: userId,
			alias: username,
			username,
			email: `${username}@example.com`,
			avatarUrl: 'https://example.com/avatar.jpg',
			role: UserRole.ADMIN,
			preferences: {
				language: 'en',
				theme: 'light',
				accessibility: {
					highContrast: false,
					textToSpeech: false,
					fontSize: 'medium',
				},
			},
			stats: {
				sessionsCompleted: 0,
				averageTrustScore: 0,
			},
		},
	};

	return response;
});

// Health check endpoint
fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
	return { status: 'ok' };
});

const start = async () => {
	try {
		await fastify.listen({ port: 3001, host: '0.0.0.0' });
		fastify.log.info('Auth Service listening on http://0.0.0.0:3001');
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

start();
