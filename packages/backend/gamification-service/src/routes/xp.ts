import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {authMiddleware} from '../middleware/auth';
import {getUserXP, getXPHistory, getDailyXP, awardXP} from '../services/xp';
import {checkAchievements} from '../services/achievements';
import {config} from '../config';

export async function xpRoutes(fastify: FastifyInstance) {
	// auth middleware
	fastify.addHook('preHandler', authMiddleware);

	// curr user xp summary from GET
	fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			const xp = await getUserXP(userId);
			return xp;
		} catch (error) {
			request.log.error({error}, 'Failed to get user XP');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to get XP summary',
			});
		}
	});

	// xp history for curr user from GET
	fastify.get<{Querystring: {limit?: string; offset?: string}}>(
		'/history',
		async (request, reply) => {
			const userId = request.user!.userId;
			const limit = Math.min(parseInt(request.query.limit || '50'), 100);
			const offset = parseInt(request.query.offset || '0');

			try {
				const history = await getXPHistory(userId, limit, offset);
				return {history};
			} catch (error) {
				request.log.error({error}, 'Failed to get XP history');
				return reply.status(500).send({
					statusCode:	500,
					error:		'Internal Server Error',
					message:	'Failed to get XP history',
				});
			}
		}
	);

	// daily xp breakdown from GET
	fastify.get<{Querystring: {days?: string}}>(
		'/daily',
		async (request, reply) => {
			const userId = request.user!.userId;
			const days = Math.min(parseInt(request.query.days || '30'), 365);

			try {
				const dailyXP = await getDailyXP(userId, days);
				return {dailyXP};
			} catch (error) {
				request.log.error({error}, 'Failed to get daily XP');
				return reply.status(500).send({
					statusCode:	500,
					error:		'Internal Server Error',
					message:	'Failed to get daily XP',
				});
			}
		}
	);

	// award xp to user from POST
	fastify.post<{
		Body: {userId: string; amount: number; reason: string; sessionId?: string};
	}>('/award', async (request, reply) => {
		// Check if user is admin or internal service
		if (request.user!.role !== 'ADMIN') {
			return reply.status(403).send({
				statusCode:	403,
				error:		'Forbidden',
				message:	'Only admins can award XP directly',
			});
		}

		const {userId, amount, reason, sessionId} = request.body;

		if (!userId || typeof amount !== 'number' || amount <= 0 || !reason) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Invalid request: userId, amount (positive), and reason are required',
			});
		}

		try {
			const result = await awardXP(userId, amount, reason, sessionId);

			// check xp triggered achievements
			const newAchievements = await checkAchievements(userId, 'XP_GAINED', {
				amount,
				totalXP: result.newLevel,
			});

			return {
				success: true,
				xpLog: result.xpLog,
				levelUp: result.levelUp,
				newLevel: result.newLevel,
				newAchievements: newAchievements.map((a) => ({
					id: a.id,
					name: a.name,
					xpReward: a.xpReward,
				})),
			};
		} catch (error) {
			request.log.error({error}, 'Failed to award XP');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to award XP',
			});
		}
	});

	// show rewards from GET req
	fastify.get('/rewards', async () => {
		return {
			rewards: config.gamification.xpRewards,
		};
	});
}
