import {FastifyRequest, FastifyReply} from 'fastify';
import jwt from 'jsonwebtoken';
import {config} from '../config';

declare module 'fastify' {
	interface FastifyRequest {
		user?: {
			userId: string;
			email: string;
			role: string;
		};
	}
}

interface JWTPayload {
	userId: string;
	email: string;
	role: string;
	timeIssued: number;
	timeExp: number;
}

// JWT middleware for auth
export async function authMiddleware(
	request: FastifyRequest,
	reply: FastifyReply
): Promise<void> {
	const authHeader = request.headers.authorization;

	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return reply.status(401).send({
			statusCode: 401,
			error: 'Unauthorized',
			message: 'Missing or invalid authorization header',
		});
	}

	const token = authHeader.substring(7);

	try {
		const payload = jwt.verify(token, config.jwt.secret) as JWTPayload;

		request.user = {
			userId: payload.userId,
			email: payload.email,
			role: payload.role,
		};
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			return reply.status(401).send({
				statusCode: 401,
				error: 'Unauthorized',
				message: 'Token has expired',
			});
		}

		if (error instanceof jwt.JsonWebTokenError) {
			return reply.status(401).send({
				statusCode: 401,
				error: 'Unauthorized',
				message: 'Invalid token',
			});
		}

		request.log.error({error}, 'Token verification failed');
		return reply.status(401).send({
			statusCode: 401,
			error: 'Unauthorized',
			message: 'Token verification failed',
		});
	}
}
