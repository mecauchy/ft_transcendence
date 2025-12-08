import Fastify from 'fastify';
import { IAuthResponse } from '../../../shared/types/auth'; // importing the contract

const	fastify = Fastify({ logger: true });

// example route adhering to the contract
fastify.post('/auth/token', async (Request, reply) => {
	// TODO: implement 42 API token gen
	const	response: IAuthResponse = {
		accessToken: "placeHolder",
		isTwoFactorEnabled: false,
		user: { id: 1, alias: "maxime"}
	};
	return response;
});

const	start = async () => {
	try {
		await fastify.listen({ port: 3001, host: '0.0.0.0' })
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};
