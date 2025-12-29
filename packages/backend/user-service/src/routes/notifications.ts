import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import Redis from 'ioredis';
import {config} from '../config';

// redis for realtime notifs
const pubClient = new Redis({
	host:	config.redis.host,
	port:	config.redis.port,
});

export type NotificationType = 
	| 'FRIEND_REQUEST'
	| 'FRIEND_ACCEPTED'
	| 'MESSAGE'
	| 'ACHIEVEMENT'
	| 'SYSTEM'
	| 'GAME_INVITE';

export interface CreateNotificationParams {
	userId:		bigint;
	type:		NotificationType;
	title:		string;
	message:	string;
	data?:		Record<string, unknown>;
}

// create and broadcast notification helper functyion
export async function createNotification(params: CreateNotificationParams): Promise<void> {
	const {userId, type, title, message, data} = params;

	const notification = await prisma.notification.create({
		data: {
			userId,
			type,
			title,
			message,
			data: (data as any) || {},
		},
	});

	// use redis to broadcast
	const payload = {
		type: 'NOTIFICATION',
		data: {
			id:			notification.id,
			type:		notification.type,
			title:		notification.title,
			message:	notification.message,
			data:		notification.data,
			createdAt:	notification.createdAt,
		},
	};

	await pubClient.publish(`user:${userId}:notifications`, JSON.stringify(payload));
}

export async function notificationRoutes(fastify: FastifyInstance) {
	// apply auth middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// list notifications
	fastify.get<{
		Querystring: {limit?: string; offset?: string; unreadOnly?: string};
	}>('/', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const limit = Math.min(parseInt(request.query.limit || '20'), 100);
		const offset = parseInt(request.query.offset || '0');
		const unreadOnly = request.query.unreadOnly === 'true';

		try {
			const [notifications, total, unreadCount] = await Promise.all([
				prisma.notification.findMany({
					where: {
						userId,
						...(unreadOnly && {isRead: false}),
					},
					orderBy:	{createdAt: 'desc'},
					take:		limit,
					skip:		offset,
				}),
				prisma.notification.count({
					where: {
						userId,
						...(unreadOnly && {isRead: false}),
					},
				}),
				prisma.notification.count({
					where: {userId, isRead: false},
				}),
			]);

			return {
				notifications: notifications.map((n) => ({
					id:			n.id,
					type:		n.type,
					title:		n.title,
					message:	n.message,
					data:		n.data,
					isRead:		n.isRead,
					createdAt:	n.createdAt,
				})),
				total,
				unreadCount,
				hasMore: offset + notifications.length < total,
			};
		} catch (error) {
			request.log.error({error}, 'Failed to fetch notifications');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch notifications',
			});
		}
	});

	// get unread count
	fastify.get('/unread-count', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const count = await prisma.notification.count({
				where: {userId, isRead: false},
			});

			return {unreadCount: count};
		} catch (error) {
			request.log.error({error}, 'Failed to fetch unread count');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch unread count',
			});
		}
	});

	// mark notif as read
	fastify.put<{Params: {id: string}}>('/:id/read', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {id} = request.params;

		try {
			const notification = await prisma.notification.findFirst({
				where: {id, userId},
			});

			if (!notification) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'Notification not found',
				});
			}

			await prisma.notification.update({
				where: {id},
				data: {isRead: true},
			});

			return {success: true, message:	'Notification marked as read'};
		} catch (error) {
			request.log.error({error}, 'Failed to mark notification as read');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to update notification',
			});
		}
	});

	// mark all notifs as read
	fastify.put('/read-all', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const result = await prisma.notification.updateMany({
				where: {userId, isRead: false},
				data: {isRead: true},
			});

			return {success: true, message:	`Marked ${result.count} notifications as read`};
		} catch (error) {
			request.log.error({error}, 'Failed to mark notifications as read');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to update notifications',
			});
		}
	});

	// delete a notif
	fastify.delete<{Params: {id: string}}>('/:id', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {id} = request.params;

		try {
			const notification = await prisma.notification.findFirst({
				where: {id, userId},
			});

			if (!notification) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'Notification not found',
				});
			}

			await prisma.notification.delete({
				where: {id},
			});

			return {success: true, message:	'Notification deleted'};
		} catch (error) {
			request.log.error({error}, 'Failed to delete notification');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to delete notification',
			});
		}
	});

	// delete all notifications
	fastify.delete('/', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const result = await prisma.notification.deleteMany({
				where: {userId},
			});

			return {success: true, message:	`Deleted ${result.count} notifications`};
		} catch (error) {
			request.log.error({error}, 'Failed to delete notifications');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to delete notifications',
			});
		}
	});
}
