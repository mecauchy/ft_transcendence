import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db';
import { authMiddleware } from '../middleware/auth';
import Redis from 'ioredis';
import { config } from '../config';
import type { IFriend } from '@speak-up/shared';

// redis track presence
const redis = new Redis({
	host: config.redis.host,
	port: config.redis.port,
});

export async function friendsRoutes(fastify: FastifyInstance) {
	// apply middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// list friends + pending
	fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			// get accepted friends
			const friendsResult = await query(
				`SELECT 
					CASE 
						WHEN f.friend_id = $1 THEN f.friend_userid 
						ELSE f.friend_id 
					END as friend_user_id,
					u.user_username,
					s.settings_avatar,
					f.friend_status,
					f.friend_creation_date
				FROM friends f
				JOIN users u ON u.user_id = CASE 
					WHEN f.friend_id = $1 THEN f.friend_userid 
					ELSE f.friend_id 
				END
				LEFT JOIN settings s ON s.settings_userid = u.user_id
				WHERE (f.friend_id = $1 OR f.friend_userid = $1)
					AND f.friend_status = 'ACCEPTED'`,
				[userId]
			);

			// get pending requests (received)
			const pendingResult = await query(
				`SELECT f.friend_id as requester_id, u.user_username, s.settings_avatar, f.friend_creation_date
				FROM friends f
				JOIN users u ON u.user_id = f.friend_id
				LEFT JOIN settings s ON s.settings_userid = u.user_id
				WHERE f.friend_userid = $1 AND f.friend_status = 'PENDING'`,
				[userId]
			);

			// get sent requests (outgoing)
			const sentResult = await query(
				`SELECT f.friend_userid as target_id, u.user_username, s.settings_avatar, f.friend_creation_date
				FROM friends f
				JOIN users u ON u.user_id = f.friend_userid
				LEFT JOIN settings s ON s.settings_userid = u.user_id
				WHERE f.friend_id = $1 AND f.friend_status = 'PENDING'`,
				[userId]
			);

			// check online status from redis
			const friends: IFriend[] = await Promise.all(
				friendsResult.rows.map(async (row) => {
					const onlineStatus = await redis.get(`presence:${row.friend_user_id}`);
					const inSession = await redis.get(`session:${row.friend_user_id}`);

					return {
						id: row.friend_user_id.toString(),
						username: row.user_username,
						status: inSession ? 'IN_SESSION' : (onlineStatus ? 'ONLINE' : 'OFFLINE') as IFriend['status'],
						lastSeen: Date.now(),
					};
				})
			);

			return {
				friends,
				pendingRequests: pendingResult.rows.map((row) => ({
					id: row.requester_id.toString(),
					username: row.user_username,
					avatarUrl: row.settings_avatar,
					requestedAt: row.friend_creation_date,
				})),
				sentRequests: sentResult.rows.map((row) => ({
					id: row.target_id.toString(),
					username: row.user_username,
					avatarUrl: row.settings_avatar,
					sentAt: row.friend_creation_date,
				})),
			};
		} catch (error) {
			request.log.error({ error }, 'Failed to fetch friends');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to fetch friends',
			});
		}
	});

	// send friend request using api
	fastify.post<{ Body: { targetId: string } }>('/', async (request, reply) => {
		const userId = request.user!.userId;
		const { targetId } = request.body;

		if (!targetId) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'Target user ID is required',
			});
		}

		if (targetId === userId) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'Cannot send friend request to yourself',
			});
		}

		try {
			// check if target exists
			const targetResult = await query(
				`SELECT user_id FROM users WHERE user_id = $1`,
				[targetId]
			);

			if (targetResult.rows.length === 0) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'Target user not found',
				});
			}

			// check if friendship exists
			const existingResult = await query(
				`SELECT friend_status FROM friends 
				WHERE (friend_id = $1 AND friend_userid = $2)
					OR (friend_id = $2 AND friend_userid = $1)`,
				[userId, targetId]
			);

			if (existingResult.rows.length > 0) {
				const status = existingResult.rows[0].friend_status;
				if (status === 'ACCEPTED') {
					return reply.status(400).send({
						statusCode: 400,
						error: 'Bad Request',
						message: 'Already friends with this user',
					});
				}
				if (status === 'PENDING') {
					return reply.status(400).send({
						statusCode: 400,
						error: 'Bad Request',
						message: 'Friend request already pending',
					});
				}
				if (status === 'BLOCKED') {
					return reply.status(403).send({
						statusCode: 403,
						error: 'Forbidden',
						message: 'Cannot send friend request to this user',
					});
				}
			}

			// create friend request
			await query(
				`INSERT INTO friends (friend_id, friend_userid, friend_status)
				 VALUES ($1, $2, 'PENDING')`,
				[userId, targetId]
			);

			// TODO: send notification via websocket

			return { success: true, status: 'PENDING' };
		} catch (error) {
			request.log.error({ error }, 'Failed to send friend request');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to send friend request',
			});
		}
	});

	// answer friend req (accept/reject)
	fastify.put<{
		Params: { id: string };
		Body: { action: 'accept' | 'reject' };
	}>('/:id', async (request, reply) => {
		const userId = request.user!.userId;
		const { id: requesterId } = request.params;
		const { action } = request.body;

		if (!['accept', 'reject'].includes(action)) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'Action must be "accept" or "reject"',
			});
		}

		try {
			// check if request exists
			const requestResult = await query(
				`SELECT * FROM friends 
				 WHERE friend_id = $1 AND friend_userid = $2 AND friend_status = 'PENDING'`,
				[requesterId, userId]
			);

			if (requestResult.rows.length === 0) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'Friend request not found',
				});
			}

			if (action === 'accept') {
				await query(
					`UPDATE friends SET friend_status = 'ACCEPTED' 
					WHERE friend_id = $1 AND friend_userid = $2`,
					[requesterId, userId]
				);
				return { success: true, status: 'ACCEPTED' };
			} else {
				await query(
					`DELETE FROM friends 
					WHERE friend_id = $1 AND friend_userid = $2`,
					[requesterId, userId]
				);
				return { success: true, status: 'REJECTED' };
			}
		} catch (error) {
			request.log.error({ error }, 'Failed to process friend request');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to process friend request',
			});
		}
	});

	// remove/cancel friend
	fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
		const userId = request.user!.userId;
		const { id: friendId } = request.params;

		try {
			const result = await query(
				`DELETE FROM friends 
				WHERE (friend_id = $1 AND friend_userid = $2)
					OR (friend_id = $2 AND friend_userid = $1)
				RETURNING *`,
				[userId, friendId]
			);

			if (result.rows.length === 0) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'Friendship not found',
				});
			}

			return { success: true, message: 'Friend removed' };
		} catch (error) {
			request.log.error({ error }, 'Failed to remove friend');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to remove friend',
			});
		}
	});

	// blocking a user
	fastify.post<{ Params: { id: string } }>('/:id/block', async (request, reply) => {
		const userId = request.user!.userId;
		const { id: targetId } = request.params;

		try {
			// remove existing friendship and set to blocked
			await query(
				`DELETE FROM friends
				WHERE (friend_id = $1 AND friend_userid = $2)
				OR (friend_id = $2 AND friend_userid = $1)`,
				[userId, targetId]
			);

			await query(
				`INSERT INTO friends (friend_id, friend_userid, friend_status)
				VALUES ($1, $2, 'BLOCKED')`,
				[userId, targetId]
			);

			return { success: true, message: 'User blocked' };
		} catch (error) {
			request.log.error({ error }, 'Failed to block user');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to block user',
			});
		}
	});
}
