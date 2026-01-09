import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import crypto from 'crypto';

// generate secure apikey
function generateApiKey(): {key: string; hash: string; prefix: string} {
	const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
	const prefix = key.substring(0, 10);
	const hash = crypto.createHash('sha256').update(key).digest('hex');
	return {key, hash, prefix};
}

// hash the key for verification
export function hashApiKey(key: string): string {
	return crypto.createHash('sha256').update(key).digest('hex');
}

export async function apiKeyRoutes(fastify: FastifyInstance) {
	// use auth middleware in routes
	fastify.addHook('preHandler', authMiddleware);

	// list API keys for user
	fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const apiKeys = await prisma.apiKey.findMany({
				where: {userId},
				orderBy: {createdAt: 'desc'},
				select: {
					id:				true,
					name:			true,
					keyPrefix:		true,
					permissions:	true,
					lastUsedAt:		true,
					expiresAt:		true,
					isActive:		true,
					createdAt:		true,
				},
			});

			return {
				apiKeys: apiKeys.map((k) => ({
					id:				k.id,
					name:			k.name,
					keyPrefix:		k.keyPrefix,
					permissions:	k.permissions,
					lastUsedAt:		k.lastUsedAt,
					expiresAt:		k.expiresAt,
					isActive:		k.isActive,
					createdAt:		k.createdAt,
				})),
			};
		} catch (error) {
			request.log.error({error}, 'Failed to fetch API keys');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch API keys',
			});
		}
	});

	// create a new apikey
	fastify.post<{
		Body: {
			name:			string;
			permissions?:	string[];
			expiresInDays?:	number;
		};
	}>('/', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {name, permissions = ['read'], expiresInDays} = request.body;

		if (!name || name.trim().length === 0) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'API key name is required',
			});
		}

		// validate perms
		const validPermissions = ['read', 'write', 'delete', 'admin'];
		const invalidPerms = permissions.filter((p) => !validPermissions.includes(p));
		if (invalidPerms.length > 0) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	`Invalid permissions: ${invalidPerms.join(', ')}`,
			});
		}

		// limit keys per user
		const existingCount = await prisma.apiKey.count({
			where: {userId, isActive: true},
		});

		if (existingCount >= 10) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Maximum of 10 active API keys allowed',
			});
		}

		try {
			const {key, hash, prefix} = generateApiKey();
			const expiresAt = expiresInDays
				? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
				: null;

			const apiKey = await prisma.apiKey.create({
				data: {
					userId,
					name:		name.trim(),
					keyHash:	hash,
					keyPrefix:	prefix,
					permissions,
					expiresAt,
				},
			});

			// return fullkey only once
			return {
				success: true,
				apiKey: {
					id:				apiKey.id,
					name:			apiKey.name,
					key,
					keyPrefix:		prefix,
					permissions:	apiKey.permissions,
					expiresAt:		apiKey.expiresAt,
					createdAt:		apiKey.createdAt,
				},
				warning: 'Store this key securely. It will not be shown again.',
			};
		} catch (error) {
			request.log.error({error}, 'Failed to create API key');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to create API key',
			});
		}
	});

	// update apikey
	fastify.put<{
		Params: {id: string};
		Body: {
			name?:			string;
			permissions?:	string[];
			isActive?:		boolean;
		};
	}>('/:id', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {id} = request.params;
		const {name, permissions, isActive} = request.body;

		try {
			const apiKey = await prisma.apiKey.findFirst({
				where: {id, userId},
			});

			if (!apiKey) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'API key not found',
				});
			}

			// validate permissions
			if (permissions) {
				const validPermissions = ['read', 'write', 'delete', 'admin'];
				const invalidPerms = permissions.filter((p) => !validPermissions.includes(p));
				if (invalidPerms.length > 0) {
					return reply.status(400).send({
						statusCode:	400,
						error:		'Bad Request',
						message:	`Invalid permissions: ${invalidPerms.join(', ')}`,
					});
				}
			}

			const updated = await prisma.apiKey.update({
				where: {id},
				data: {
					...(name && {name: name.trim()}),
					...(permissions && {permissions}),
					...(isActive !== undefined && {isActive}),
				},
			});

			return {
				success: true,
				apiKey: {
					id: updated.id,
					name: updated.name,
					keyPrefix: updated.keyPrefix,
					permissions: updated.permissions,
					isActive: updated.isActive,
					expiresAt: updated.expiresAt,
				},
			};
		} catch (error) {
			request.log.error({error}, 'Failed to update API key');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to update API key',
			});
		}
	});

	// delete apikey
	fastify.delete<{Params: {id: string}}>('/:id', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {id} = request.params;

		try {
			const apiKey = await prisma.apiKey.findFirst({
				where: {id, userId},
			});

			if (!apiKey) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'API key not found',
				});
			}

			await prisma.apiKey.delete({
				where: {id},
			});

			return {success: true, message:	'API key deleted'};
		} catch (error) {
			request.log.error({error}, 'Failed to delete API key');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to delete API key',
			});
		}
	});
}
