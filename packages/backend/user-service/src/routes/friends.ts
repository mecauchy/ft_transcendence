import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import Redis from 'ioredis';
import {config} from '../config';
import type {IFriend} from '@speak-up/shared';
import {createNotification} from './notifications';

// redis track presence
const redis = new Redis({
	host: config.redis.host,
	port: config.redis.port,
});

// achievement event trigger helper
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

export async function friendsRoutes(fastify: FastifyInstance) {
	// apply middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// list friends + pending
	fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			// get accepted friends (where user is initiator)
			const friendsAsInitiator = await prisma.friend.findMany({
				where: {
					initiatorId: userId,
					status: 'ACCEPTED',
				},
				include: {
					receiver: {
						include: {
							settings: {select: {avatar: true}},
						},
					},
				},
			});

			// get accepted friends (where user is receiver)
			const friendsAsReceiver = await prisma.friend.findMany({
				where: {
					receiverId: userId,
					status: 'ACCEPTED',
				},
				include: {
					initiator: {
						include: {
							settings: {select: {avatar: true}},
						},
					},
				},
			});

			// get pending requests (received - user is receiver)
			const pendingReceived = await prisma.friend.findMany({
				where: {
					receiverId: userId,
					status: 'PENDING',
				},
				include: {
					initiator: {
						include: {
							settings: {select: {avatar: true}},
						},
					},
				},
			});

			// get sent requests (outgoing - user is initiator)
			const pendingSent = await prisma.friend.findMany({
				where: {
					initiatorId: userId,
					status: 'PENDING',
				},
				include: {
					receiver: {
						include: {
							settings: {select: {avatar: true}},
						},
					},
				},
			});

			// check online status from redis
			const friends: IFriend[] = await Promise.all([
				...friendsAsInitiator.map(async (f) => {
					const friendUser = f.receiver;
					const onlineStatus = await redis.get(`presence:${friendUser.id}`);
					const inSession = await redis.get(`session:${friendUser.id}`);
					return {
						id: friendUser.id.toString(),
						username: friendUser.username,
						status: (inSession ? 'IN_SESSION' : (onlineStatus ? 'ONLINE' : 'OFFLINE')) as IFriend['status'],
						lastSeen: Date.now(),
					};
				}),
				...friendsAsReceiver.map(async (f) => {
					const friendUser = f.initiator;
					const onlineStatus = await redis.get(`presence:${friendUser.id}`);
					const inSession = await redis.get(`session:${friendUser.id}`);
					return {
						id: friendUser.id.toString(),
						username: friendUser.username,
						status: (inSession ? 'IN_SESSION' : (onlineStatus ? 'ONLINE' : 'OFFLINE')) as IFriend['status'],
						lastSeen: Date.now(),
					};
				}),
			]);

			return {
				friends,
				pendingRequests: pendingReceived.map((f) => ({
					id: f.initiator.id.toString(),
					username: f.initiator.username,
					avatarUrl: f.initiator.settings?.avatar,
					requestedAt: f.createdAt,
				})),
				sentRequests: pendingSent.map((f) => ({
					id: f.receiver.id.toString(),
					username: f.receiver.username,
					avatarUrl: f.receiver.settings?.avatar,
					sentAt: f.createdAt,
				})),
			};
		} catch (error) {
			request.log.error({error}, 'Failed to fetch friends');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch friends',
			});
		}
	});

	// send friend request using api
	fastify.post<{Body: {targetUsername?: string}}>('/', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {targetUsername} = request.body;

		if (!targetUsername) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Target username is required',
			});
		}

		let targetUser;
		try {
			// find target username
			if (targetUsername) {
				targetUser = await prisma.user.findUnique({
					where: {username: targetUsername},
				});
			}

			if (!targetUser) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'Target user not found',
				});
			}

			const targetIdBigInt = targetUser.id;

			if (targetIdBigInt === userId) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Cannot send friend request to yourself',
				});
			}

			// check if friendship exists (either direction)
			const existingFriend = await prisma.friend.findFirst({
				where: {
					OR: [
						{initiatorId: userId, receiverId: targetIdBigInt},
						{initiatorId: targetIdBigInt, receiverId: userId},
					],
				},
			});

			if (existingFriend) {
				const status = existingFriend.status;
				if (status === 'ACCEPTED') {
					return reply.status(400).send({
						statusCode:	400,
						error:		'Bad Request',
						message:	'Already friends with this user',
					});
				}
				if (status === 'PENDING') {
					return reply.status(400).send({
						statusCode:	400,
						error:		'Bad Request',
						message:	'Friend request already pending',
					});
				}
				if (status === 'BLOCKED') {
					return reply.status(403).send({
						statusCode:	403,
						error:		'Forbidden',
						message:	'Cannot send friend request to this user',
					});
				}
			}

			// create friend request
			await prisma.friend.create({
				data: {
					initiatorId: userId,
					receiverId: targetIdBigInt,
					status: 'PENDING',
				},
			});

			// get current user info for notification
			const currentUser = await prisma.user.findUnique({
				where:	{id: userId},
				select:	{username: true, displayName: true},
			});

			// send notification to target user
			await createNotification({
				userId:		targetIdBigInt,
				type:		'FRIEND_REQUEST',
				title:		'New Friend Request',
				message:	`${currentUser?.displayName || currentUser?.username} sent you a friend request`,
				data:		{fromUserId: userId.toString()},
			});

			return {success: true, status: 'PENDING'};
		} catch (error) {
			request.log.error({error}, 'Failed to send friend request');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to send friend request',
			});
		}
	});

	// answer friend req (accept/reject)
	fastify.put<{
		Params: {id: string};
		Body: {action: 'accept' | 'reject'};
	}>('/:id', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const requesterId = BigInt(request.params.id);
		const {action} = request.body;

		if (!['accept', 'reject'].includes(action)) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Action must be "accept" or "reject"',
			});
		}

		try {
			// check if request exists (requester initiated, current user is receiver)
			const friendRequest = await prisma.friend.findFirst({
				where: {
					initiatorId: requesterId,
					receiverId: userId,
					status: 'PENDING',
				},
			});

			if (!friendRequest) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'Friend request not found',
				});
			}

			if (action === 'accept') {
				await prisma.friend.update({
					where: {
						initiatorId_receiverId: {
							initiatorId: requesterId,
							receiverId: userId,
						},
					},
					data: {status: 'ACCEPTED'},
				});

				// trigger achievement event for both users
				await Promise.all([
					triggerAchievementEvent(userId.toString(), 'FRIEND_ACCEPTED'),
					triggerAchievementEvent(requesterId.toString(), 'FRIEND_ACCEPTED'),
				]);

				await Promise.all([
					awardXpInternal(userId.toString(), 25, 'Made a new friend'),
					awardXpInternal(requesterId.toString(), 25, 'Made a new friend'),
				]);

				// get user info for notification
				const currentUser = await prisma.user.findUnique({
					where:	{id: userId},
					select:	{username: true, displayName: true},
				});

				// send notif to requester
				await createNotification({
					userId:		requesterId,
					type:		'FRIEND_ACCEPTED',
					title:		'Friend Request Accepted',
					message:	`${currentUser?.displayName || currentUser?.username} accepted your friend request`,
					data:		{userId: userId.toString()},
				});

				return {success: true, status: 'ACCEPTED'};
			} else {
				await prisma.friend.delete({
					where: {
						initiatorId_receiverId: {
							initiatorId: requesterId,
							receiverId: userId,
						},
					},
				});
				return {success: true, status: 'REJECTED'};
			}
		} catch (error) {
			request.log.error({error}, 'Failed to process friend request');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to process friend request',
			});
		}
	});

	// remove/cancel friend
	fastify.delete<{Params: {id: string}}>('/:id', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const friendId = BigInt(request.params.id);

		try {
			// try to delete where user is initiator
			const deleted = await prisma.friend.deleteMany({
				where: {
					OR: [
						{initiatorId: userId, receiverId: friendId},
						{initiatorId: friendId, receiverId: userId},
					],
				},
			});

			if (deleted.count === 0) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'Friendship not found',
				});
			}

			return {success: true, message:	'Friend removed'};
		} catch (error) {
			request.log.error({error}, 'Failed to remove friend');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to remove friend',
			});
		}
	});

	// blocking a user
	fastify.post<{Params: {id: string}}>('/:id/block', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const targetId = BigInt(request.params.id);

		try {
			// remove existing friendship
			await prisma.friend.deleteMany({
				where: {
					OR: [
						{initiatorId: userId, receiverId: targetId},
						{initiatorId: targetId, receiverId: userId},
					],
				},
			});

			// create blocked entry
			await prisma.friend.create({
				data: {
					initiatorId: userId,
					receiverId: targetId,
					status: 'BLOCKED',
				},
			});

			// trigg achievement event
			await triggerAchievementEvent(userId.toString(), 'USER_BLOCKED');

			return {success: true, message:	'User blocked'};
		} catch (error) {
			request.log.error({error}, 'Failed to block user');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to block user',
			});
		}
	});

	// unblocking a user
	fastify.post<{Params: {id: string}}>('/:id/unblock', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const targetId = BigInt(request.params.id);

		try {
			// remove blocked entry
			const deleted = await prisma.friend.deleteMany({
				where: {
					initiatorId: userId,
					receiverId: targetId,
					status: 'BLOCKED',
				},
			});

			if (deleted.count === 0) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'User is not blocked',
				});
			}

			return {success: true, message: 'User unblocked'};
		} catch (error) {
			request.log.error({error}, 'Failed to unblock user');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to unblock user',
			});
		}
	});
}
