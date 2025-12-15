import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { IAuthResponse } from '../../../shared/types/auth'; // importing the contract
import { UserRole } from '../../../shared/types/user'; // importing enum for user roles

const fastify = Fastify({ logger: true });

// example route adhering to the contract
fastify.post<{ Reply: IAuthResponse }>('/auth/token', async (request: FastifyRequest, reply: FastifyReply) => {
	// TODO: implement 42 API token gen
	const response: IAuthResponse = {
		accessToken: "placeHolder",
		refreshToken: "refreshTokenPlaceholder", // Added refreshToken
		require2FA: false,
		user: { 
			id: "1", 
			alias: "maxime", 
			username: "maxime", 
			email: "maxime@example.com", 
			avatarUrl: "http://example.com/avatar.jpg", 
			role: UserRole.ADMIN, // Add a valid role
			preferences: {
				language: "en", // or "fr"
				theme: "light", // or "dark"
				accessibility: {
					highContrast: false,
					textToSpeech: false,
					fontSize: "medium" // or "small" or "large"
				}
			}, // Add valid preferences
			stats: {
				sessionsCompleted: 0,
				averageTrustScore: 0
			} // Add valid stats
		} 
	};
	return response;
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
