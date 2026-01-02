import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {checkAchievements} from '../services/achievements';
import {awardXP} from '../services/xp';

function requireInternalKey(request: FastifyRequest, reply: FastifyReply): boolean {
	const expected = process.env.INTERNAL_SERVICE_KEY;
	const got = request.headers['x-internal-key'];

	if (!expected) {
		reply.status(500).send({
			statusCode: 500,
			error: 'Internal Server Error',
			message: 'INTERNAL_SERVICE_KEY not set',
		});
		return false;
	}

	if (typeof got !== 'string' || got !== expected) {
		reply.status(403).send({
			statusCode: 403,
			error: 'Forbidden',
			message: 'Invalid internal key',
		});
		return false;
	}

	return true;
}

export async function internalRoutes(fastify: FastifyInstance) {
	fastify.post<{
		Body: { userId: string; eventType: string; eventData?: Record<string, unknown> };
	}>('/events', async (request, reply) => {
		if (!requireInternalKey(request, reply)) return;

		const { userId, eventType, eventData } = request.body || ({} as any);

		if (!userId || !eventType) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'userId and eventType are required',
			});
		}

		try {
			const newlyUnlocked = await checkAchievements(userId, eventType, eventData || {});
			return {
				ok: true,
				newlyUnlocked: newlyUnlocked.map((a) => ({
					id: a.id,
					code: a.code,
					name: a.name,
					rarity: a.rarity,
					xpReward: a.xpReward,
				})),
			};
		} catch (error) {
			request.log.error({ error }, 'Internal event achievement check failed');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to process event',
			});
		}
	});

	fastify.post<{
		Body: { userId: string; amount: number; reason: string; sessionId?: string };
	}>('/xp/award', async (request, reply) => {
		if (!requireInternalKey(request, reply)) return;

		const { userId, amount, reason, sessionId } = request.body || ({} as any);

		if (!userId || typeof amount !== 'number' || !reason) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'userId, amount, and reason are required',
			});
		}

		if (amount <= 0 || amount > 10000) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'Amount must be between 1 and 10000',
			});
		}

		try {
			const result = await awardXP(userId, amount, reason, sessionId);
			return {
				ok: true,
				xpAwarded: result.xpLog.amount,
				levelUp: result.levelUp,
				newLevel: result.newLevel,
			};
		} catch (error) {
			request.log.error({ error }, 'Internal XP award failed');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to award XP',
			});
		}
	});
}
