import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import Redis from 'ioredis';
import {config} from '../config';

// redis for realtime message broadcasting
const redis = new Redis({
	host:	config.redis.host,
	port:	config.redis.port,
});

const pubClient = new Redis({
	host:	config.redis.host,
	port:	config.redis.port,
});

// helper to trigger achievement events
async function triggerAchievementEvent(
	userId: string,
	eventType: string,
	eventData?: Record<string, unknown>
): Promise<void> {
	const internalKey = process.env.INTERNAL_SERVICE_KEY;
	const gamificationServiceUrl = process.env.GAMIFICATION_SERVICE_INTERNAL_URL || 'http://gamification-service:3004';

	if (!internalKey) {
		return;
	}

	try {
		await fetch(`${gamificationServiceUrl}/internal/events`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-internal-key': internalKey,
			},
			body: JSON.stringify({
				userId,
				eventType,
				eventData: eventData || {},
			}),
		});
	} catch (error) {
		console.error('Failed to trigger achievement event:', error);
	}
}

// helper to award XP via internal API
async function awardXpInternal(
	userId: string,
	amount: number,
	reason: string
): Promise<void> {
	const internalKey = process.env.INTERNAL_SERVICE_KEY;
	const gamificationServiceUrl = process.env.GAMIFICATION_SERVICE_INTERNAL_URL || 'http://gamification-service:3004';

	if (!internalKey) {
		return;
	}

	try {
		await fetch(`${gamificationServiceUrl}/internal/xp/award`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-internal-key': internalKey,
			},
			body: JSON.stringify({
				userId,
				amount,
				reason,
			}),
		});
	} catch (error) {
		console.error('Failed to award XP:', error);
	}
}

export async function chatRoutes(fastify: FastifyInstance) {
	// apply auth middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// list all convo for current user
	fastify.get('/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const conversations = await prisma.conversation.findMany({
				where: {
					OR: [
						{user1Id: userId},
						{user2Id: userId},
					],
				},
				include: {
					user1: {
						select: {
							id:				true,
							username:		true,
							displayName:	true,
							avatarUrl:		true,
						},
					},
					user2: {
						select: {
							id:				true,
							username:		true,
							displayName:	true,
							avatarUrl:		true,
						},
					},
					messages: {
						orderBy: {createdAt: 'desc'},
						take: 1,
					},
				},
				orderBy: {updatedAt: 'desc'},
			});

			// format response
			const formatted = conversations.map((conv) => {
				const otherUser = conv.user1Id === userId ? conv.user2 : conv.user1;
				const lastMessage = conv.messages[0] || null;

				return {
					id: conv.id,
					otherUser: {
						id:				otherUser.id.toString(),
						username:		otherUser.username,
						displayName:	otherUser.displayName,
						avatarUrl:		otherUser.avatarUrl,
					},
					lastMessage: lastMessage ? {
						id:			lastMessage.id,
						content:	lastMessage.content.substring(0, 100),
						senderId:	lastMessage.senderId.toString(),
						isRead:		lastMessage.isRead,
						createdAt:	lastMessage.createdAt,
					} : null,
					updatedAt: conv.updatedAt,
				};
			});

			return {conversations: formatted};
		} catch (error) {
			request.log.error({error}, 'Failed to fetch conversations');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch conversations',
			});
		}
	});

	// get or create convo with user
	fastify.get<{Params: {userId: string}}>('/conversations/:userId', async (request, reply) => {
		const currentUserId = BigInt(request.user!.userId);
		const targetUserId = BigInt(request.params.userId);

		if (currentUserId === targetUserId) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Cannot start conversation with yourself',
			});
		}

		try {
			// check if target exists
			const targetUser = await prisma.user.findUnique({
				where: {id: targetUserId},
				select: {id: true, username: true, displayName: true, avatarUrl: true},
			});

			if (!targetUser) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'User not found',
				});
			}

			// check if blocked, refuse
			const blocked = await prisma.friend.findFirst({
				where: {
					OR: [
						{initiatorId: currentUserId, receiverId: targetUserId, status: 'BLOCKED'},
						{initiatorId: targetUserId, receiverId: currentUserId, status: 'BLOCKED'},
					],
				},
			});

			// refuse message to someone who blocked you
			if (blocked) {
				return reply.status(403).send({
					statusCode:	403,
					error:		'Forbidden',
					message:	'Cannot message this user',
				});
			}

			// order by uids
			const [user1Id, user2Id] = currentUserId < targetUserId
				? [currentUserId, targetUserId]
				: [targetUserId, currentUserId];

			// find or create convo
			let conversation = await prisma.conversation.findFirst({
				where: {user1Id, user2Id},
			});

			if (!conversation) {
				conversation = await prisma.conversation.create({
					data: {user1Id, user2Id},
				});
			}

			return {
				conversationId: conversation.id,
				otherUser: {
					id:				targetUser.id.toString(),
					username:		targetUser.username,
					displayName:	targetUser.displayName,
					avatarUrl:		targetUser.avatarUrl,
				},
			};
		} catch (error) {
			request.log.error({error}, 'Failed to get/create conversation');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to get conversation',
			});
		}
	});

	// get messages in a convo
	fastify.get<{
		Params: {conversationId: string};
		Querystring: {limit?: string; before?: string};
	}>('/messages/:conversationId', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {conversationId} = request.params;
		const limit = Math.min(parseInt(request.query.limit || '50'), 100);
		const before = request.query.before;

		try {
			// verify user is part of convo (either uid1 or uid2)
			const conversation = await prisma.conversation.findFirst({
				where: {
					id: conversationId,
					OR: [
						{user1Id: userId},
						{user2Id: userId},
					],
				},
			});

			if (!conversation) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'Conversation not found',
				});
			}

			// paginate messages
			const messages = await prisma.message.findMany({
				where: {
					conversationId,
					...(before && {createdAt: {lt: new Date(before)}}),
				},
				orderBy: {createdAt: 'desc'},
				take: limit,
				select: {
					id:			true,
					senderId:	true,
					receiverId:	true,
					content:	true,
					isRead:		true,
					createdAt:	true,
				},
			});

			// mark msg as read on view
			await prisma.message.updateMany({
				where: {
					conversationId,
					receiverId:	userId,
					isRead:		false,
				},
				data: {isRead: true},
			});

			return {
				messages: messages.map((msg) => ({
					id:			msg.id,
					senderId:	msg.senderId.toString(),
					receiverId:	msg.receiverId.toString(),
					content:	msg.content,
					isRead:		msg.isRead,
					createdAt:	msg.createdAt,
				})),
				hasMore: messages.length === limit,
			};
		} catch (error) {
			request.log.error({error}, 'Failed to fetch messages');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch messages',
			});
		}
	});

	// send a message
	fastify.post<{
		Body: {conversationId?: string; receiverId?: string; content: string};
	}>('/messages', async (request, reply) => {
		const senderId = BigInt(request.user!.userId);
		const {conversationId: convId, receiverId: recvId, content} = request.body;

		if (!content || content.trim().length === 0) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Message content is required',
			});
		}

		if (content.length > 2000) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Message too long (max 2000 characters)',
			});
		}

		if (!convId && !recvId) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Either conversationId or receiverId is required',
			});
		}

		try {
			let conversation;
			let receiverId: bigint;

			if (convId) {
				// verify if user is in convo
				conversation = await prisma.conversation.findFirst({
					where: {
						id: convId,
						OR: [
							{user1Id: senderId},
							{user2Id: senderId},
						],
					},
				});

				if (!conversation) {
					return reply.status(404).send({
						statusCode:	404,
						error:		'Not Found',
						message:	'Conversation not found',
					});
				}

				receiverId = conversation.user1Id === senderId
					? conversation.user2Id
					: conversation.user1Id;
			} else {
				receiverId = BigInt(recvId!);

				const receiver = await prisma.user.findUnique({
					where: {id: receiverId},
					select: {id: true},
				});

				if (!receiver) {
					return reply.status(404).send({
						statusCode:	404,
						error:		'Not Found',
						message:	'Receiver not found',
					});
				}

				// check if blocked
				const blocked = await prisma.friend.findFirst({
					where: {
						OR: [
							{initiatorId: senderId, receiverId: receiverId, status: 'BLOCKED'},
							{initiatorId: receiverId, receiverId: senderId, status: 'BLOCKED'},
						],
					},
				});

				if (blocked) {
					return reply.status(403).send({
						statusCode:	403,
						error:		'Forbidden',
						message:	'Cannot send message to this user',
					});
				}

				// find convo if existing
				conversation = await prisma.conversation.findFirst({
					where: {
						OR: [
							{user1Id: senderId, user2Id: receiverId},
							{user1Id: receiverId, user2Id: senderId},
						],
					},
				});

				// if not then create
				if (!conversation) {
					conversation = await prisma.conversation.create({
						data: {
							user1Id: senderId,
							user2Id: receiverId,
						},
					});
				}
			}

			// create message
			const message = await prisma.message.create({
				data: {
					conversationId: conversation.id,
					senderId,
					receiverId,
					content: content.trim(),
				},
			});

			// trigger achievement event
			await triggerAchievementEvent(senderId.toString(), 'CHAT_MESSAGE_SENT');

			// small xp for convo
			const today = new Date().toISOString().split('T')[0];
			const cacheKey = `xp:msg:${senderId}:${conversation.id}:${today}`;
			const alreadyAwarded = await redis.get(cacheKey);
			if (!alreadyAwarded) {
				await awardXpInternal(senderId.toString(), 5, 'Chat message sent');
				await redis.setex(cacheKey, 86400, '1');
			}

			// update conversation timestamp
			await prisma.conversation.update({
				where: {id: conversation.id},
				data: {updatedAt: new Date()},
			});

			// publish to Redis (realtime delivery)
			const messagePayload = {
				type: 'NEW_MESSAGE',
				data: {
					id:			message.id,
					conversationId: conversation.id,
					senderId:	senderId.toString(),
					receiverId:	receiverId.toString(),
					content:	message.content,
					createdAt:	message.createdAt,
				},
			};

			await pubClient.publish(`user:${receiverId}:messages`, JSON.stringify(messagePayload));

			// create notif for receiver
			await prisma.notification.create({
				data: {
					userId:		receiverId,
					type:		'MESSAGE',
					title:		'New Message',
					message:	`You have a new message`,
					data:		{conversationId: conversation.id, messageId: message.id},
				},
			});

			return {
				success: true,
				messageId:	message.id,
				conversationId: conversation.id,
			};
		} catch (error) {
			request.log.error({error}, 'Failed to send message');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to send message',
			});
		}
	});

	// delete a message
	fastify.delete<{Params: {messageId: string}}>('/messages/:messageId', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {messageId} = request.params;

		try {
			const message = await prisma.message.findUnique({
				where: {id: messageId},
			});

			if (!message) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'Message not found',
				});
			}

			// can only delete your own message
			if (message.senderId !== userId) {
				return reply.status(403).send({
					statusCode:	403,
					error:		'Forbidden',
					message:	'Cannot delete this message',
				});
			}

			await prisma.message.delete({
				where: {id: messageId},
			});

			return {success: true, message:	'Message deleted'};
		} catch (error) {
			request.log.error({error}, 'Failed to delete message');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to delete message',
			});
		}
	});

	// get unread msg count for notif bubble
	fastify.get('/unread', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const count = await prisma.message.count({
				where: {
					receiverId:	userId,
					isRead:		false,
				},
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
}
