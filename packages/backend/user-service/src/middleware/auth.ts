import {FastifyRequest, FastifyReply} from 'fastify';
import jwt, {JwtPayload} from 'jsonwebtoken';
import {config} from '../config';

export interface AuthenticatedUser {
	userId: string;
	role: string;
	requires2FA?: boolean;
}

declare module 'fastify' {
	interface FastifyRequest {
		user?: AuthenticatedUser;
	}
}

// auth middleware verif
export async function authMiddleware(
	request: FastifyRequest,
	reply: FastifyReply
): Promise<void> {
	const authHeader = request.headers.authorization;

	if (!authHeader?.startsWith('Bearer ')) {
		reply.status(401).send({
			statusCode:	401,
			error:		'Unauthorized',
			message:	'Missing or invalid authorization header',
		});
		return;
	}

	try {
		const token = authHeader.substring(7);
		const decoded = jwt.verify(token, config.jwt.secret, {
			issuer: config.jwt.issuer,
		}) as JwtPayload & AuthenticatedUser;

		// check if 2FA is required
		if (decoded.requires2FA) {
			reply.status(403).send({
				statusCode:	403,
				error:		'Forbidden',
				message:	'2FA verification required',
			});
			return;
		}

		request.user = {
			userId: decoded.userId,
			role: decoded.role,
			requires2FA: decoded.requires2FA,
		};
	} catch (error) {
		reply.status(401).send({
			statusCode:	401,
			error:		'Unauthorized',
			message:	'Invalid or expired token',
		});
	}
}
