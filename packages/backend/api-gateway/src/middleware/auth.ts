import {FastifyRequest, FastifyReply} from 'fastify';
import jwt from 'jsonwebtoken';
import {config} from '../config';

export interface	JWTPayload {
	userId:			string;
	role:			string;
	requires2FA?:	boolean;
	twoFAVerified?:	boolean;
	timeIssued?:	number;
	timeExp?:		number;
}

declare module	'fastify' {
	interface	FastifyRequest {
		user?:	JWTPayload;
	}
}

// AuthGuard | JWT verification middleware for protected routes following devsecops constraints by maxime
// format: Bearer <token>
export async function authGuard(request: FastifyRequest, reply: FastifyReply) : Promise<void> {
	const authHeader = request.headers.authorization;

	// check if auth header exists
	if (!authHeader) {
		request.log.warn({ip: request.ip, url: request.url}, 'Missing Authorization header');
		return reply.status(401).send({
			statusCode: 401,
			error: 'Unauthorized',
			message: 'Authorization header is required. Format: Bearer <token>',
		});
	}

	// check bearer token format
	if (!authHeader.startsWith('Bearer ')) {
		request.log.warn({ip: request.ip}, 'Invalid Authorization header format');
		return reply.status(401).send({
			statusCode: 401,
			error: 'Unauthorized',
			message: 'Invalid Authorization header format. Expected: Bearer <token>',
		});
	}

	// remove prefix 'Bearer'
	const token = authHeader.slice(7);

	if (!token || token.trim() === '') {
		request.log.warn({ip: request.ip}, 'Empty token provided');
		return reply.status(401).send({
			statusCode: 401,
			error: 'Unauthorized',
			message: 'Token is required',
		});
	}

	try {
		// verify jwt signature and expiration
		const decoded = jwt.verify(token, config.security.jwtSecret,
									{algorithms: ['HS256'],}) as JWTPayload;

		// check if 2FA is required but not verified
		if (decoded.requires2FA && !decoded.twoFAVerified) {
			request.log.warn({userId: decoded.userId}, '2FA required but not verified');
			return reply.status(403).send({
				statusCode: 403,
				error: 'Forbidden',
				message: '2FA verification required. Please complete two-factor authentication.',
				require2FA: true,
			});
		}

		// add user info to request
		request.user = decoded;

		// forward context via headers
		request.headers['x-user-id'] = decoded.userId;
		request.headers['x-user-role'] = decoded.role;
		request.headers['x-auth-verified'] = 'true';

		// debug log
		request.log.debug({userId: decoded.userId, role: decoded.role, url: request.url},
							'Request authenticated successfully');

	} catch (error) {
		// throw error for expired jwt token
		if (error instanceof jwt.TokenExpiredError) {
			request.log.warn({ip: request.ip}, 'Token expired');
			return reply.status(401).send({
				statusCode: 401,
				error: 'Unauthorized',
				message: 'Token has expired. Please refresh your token or login again.',
				code: 'TOKEN_EXPIRED',
			});
		}

		// throw error for invalid jwt token
		if (error instanceof jwt.JsonWebTokenError) {
			request.log.warn({ip: request.ip, error: (error as Error).message}, 'Invalid token');
			return reply.status(401).send({
				statusCode: 401,
				error: 'Unauthorized',
				message: 'Invalid token. Please login again.',
				code: 'TOKEN_INVALID',
			});
		}

		// internal server err
		request.log.error({error}, 'Unexpected error during token verification');
		return reply.status(500).send({
			statusCode: 500,
			error: 'Internal Server Error',
			message: 'Failed to verify authentication token',
		});
	}
}

// optional auth -> attaches user info if found token (non-blocking)
export async function optionalAuth(request: FastifyRequest, _reply: FastifyReply) : Promise<void> {
	const authHeader = request.headers.authorization;

	// if prefix not found
	if (!authHeader || !authHeader.startsWith('Bearer '))
		return;

	// remove prefix
	const token = authHeader.slice(7);

	try {
		// try decode jwt tok
		const decoded = jwt.verify(token, config.security.jwtSecret,
								{algorithms: ['HS256'],}) as JWTPayload;

		// add decoded data to headers
		request.user = decoded;
		request.headers['x-user-id'] = decoded.userId;
		request.headers['x-user-role'] = decoded.role;
	} catch {
		// silent ignore invalid tokens for optional auth
		request.log.debug('Optional auth: invalid token, continuing as anonymous');
	}
}

// after authGuard, use this rolebased access control to restrict routes
export function requireRole(...allowedRoles: string[]) {
	return async function roleGuard(request: FastifyRequest, reply: FastifyReply) : Promise<void> {
		if (!request.user) {
			return reply.status(401).send({
				statusCode: 401,
				error: 'Unauthorized',
				message: 'Authentication required',
			});
		}

		// deny access on userrole not found in allowedroles
		if (!allowedRoles.includes(request.user.role)) {
			request.log.warn({userId: request.user.userId, role: request.user.role, required: allowedRoles},
							'Access denied: insufficient role');
			// return debug for roles needed to access
			return reply.status(403).send({
				statusCode: 403,
				error: 'Forbidden',
				message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
			});
		}
	};
}
