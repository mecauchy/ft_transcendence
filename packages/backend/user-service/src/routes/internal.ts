import {FastifyInstance} from 'fastify';
import {prisma} from '../db';

export async function internalRoutes(fastify: FastifyInstance) {
	// validate an API key
	fastify.post<{Body: {keyHash: string}}>('/validate-api-key', async (request, reply) => {
		const {keyHash} = request.body;

		if (!keyHash) {
			return reply.status(400).send({valid: false, message:	'Key hash required'});
		}

		try {
			const apiKey = await prisma.apiKey.findUnique({
				where: {keyHash},
				include: {
					user: {
						select: {id: true, role: true},
					},
				},
			});

			// key not found
			if (!apiKey) {
				return {valid: false, message:	'API key not found'};
			}

			// key inactive
			if (!apiKey.isActive) {
				return {valid: false, message:	'API key is inactive'};
			}

			// key expired
			if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
				return {valid: false, message:	'API key has expired'};
			}

			// update timestamp for last used
			await prisma.apiKey.update({
				where: {id: apiKey.id},
				data: {lastUsedAt: new Date()},
			});

			return {
				valid: true,
				userId: apiKey.userId.toString(),
				permissions: apiKey.permissions,
				userRole: apiKey.user.role,
			};
		} catch (error) {
			request.log.error({error}, 'Failed to validate API key');
			return reply.status(500).send({valid: false, message:	'Validation error'});
		}
	});

	// create notification
	fastify.post<{
		Body: {
			userId:		string;
			type:		string;
			title:		string;
			message:	string;
			data?:		Record<string, unknown>;
		};
	}>('/create-notification', async (request, reply) => {
		const {userId, type, title, message, data} = request.body;

		if (!userId || !type || !title || !message) {
			return reply.status(400).send({
				success:	false,
				message:	'Missing required fields',
			});
		}

		try {
			const notification = await prisma.notification.create({
				data: {
					userId:	BigInt(userId),
					type:	type as any,
					title,
					message,
					data:	(data as any) || {},
				},
			});

			return {
				success: true,
				notificationId: notification.id,
			};
		} catch (error) {
			request.log.error({error}, 'Failed to create notification');
			return reply.status(500).send({
				success: false,
				message:	'Failed to create notification',
			});
		}
	});
}
