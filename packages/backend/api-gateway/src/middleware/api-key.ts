import {FastifyRequest, FastifyReply} from 'fastify';
import crypto from 'crypto';

// middleware for public api access
interface ApiKeyPayload {
	userId:			string;
	permissions:	string[];
}

// hash key for verif
function hashApiKey(key: string): string {
	return (crypto.createHash('sha256').update(key).digest('hex'));
}

// validate api
async function validateApiKey(keyHash: string): Promise<ApiKeyPayload | null> {
	// requests to user service to validate
	// TODO: For production, consider adding caching or a shared db connection to reduce latency
	try {
		const response = await fetch('http://user-service:3002/internal/validate-api-key', {
			method:		'POST',
			headers:	{'Content-Type': 'application/json'},
			body:		JSON.stringify({keyHash}),
		});

		if (!response.ok) {
			return (null);
		}

		const data = await response.json() as {valid: boolean; userId: string; permissions: string[]};
		if (!data.valid) {
			return (null);
		}

		return {
			userId:			data.userId,
			permissions:	data.permissions,
		};
	} catch (error) {
		console.error('API key validation error:', error);
		return (null);
	}
}

// api auth middleware
export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	const apiKey = request.headers['x-api-key'] as string | undefined;

	// if no api given just skip
	if (!apiKey) {
		return;
	}

	// validate key format
	if (!apiKey.startsWith('sk_') || apiKey.length !== 67) {
		reply.status(401).send({
			statusCode:	401,
			error:		'Unauthorized',
			message:	'Invalid API key format',
		});
		return;
	}

	const keyHash = hashApiKey(apiKey);
	const payload = await validateApiKey(keyHash);

	if (!payload) {
		reply.status(401).send({
			statusCode:	401,
			error:		'Unauthorized',
			message:	'Invalid or expired API key',
		});
		return;
	}

	// set context from key
	(request as any).user = {
		userId:			payload.userId,
		role:			'API',
		permissions:	payload.permissions,
		authMethod:		'api_key',
	};

	// add key info to request
	(request as any).apiKeyUsed = true;
}

// check user permissions
export function requirePermission(permission: string) {
	return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
		const user = (request as any).user;

		if (!user) {
			reply.status(401).send({
				statusCode:	401,
				error:		'Unauthorized',
				message:	'Authentication required',
			});
			return;
		}

		// always give access if user is admin
		if (user.role === 'ADMIN') {
			return;
		}

		// check if using key and has permission
		if (user.authMethod === 'api_key') {
			if (!user.permissions || !user.permissions.includes(permission)) {
				reply.status(403).send({
					statusCode:	403,
					error:		'Forbidden',
					message:	`API key missing required permission: ${permission}`,
				});
				return;
			}
		}
	};
}
