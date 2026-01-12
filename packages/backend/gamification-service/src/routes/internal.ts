import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {checkAchievements} from '../services/achievements';
import {awardXP, getUserXP} from '../services/xp';

// notify user service
async function notifyLevelUp(userId: string, newLevel: number, oldLevel: number): Promise<void> {
	const internalKey = process.env.INTERNAL_SERVICE_KEY;
	const userServiceInternal =
		process.env.USER_SERVICE_INTERNAL_URL ||
		'http://user-service:3002';

	if (!internalKey) {
		return;
	}

	// send notif for each level gained
	for (let level = oldLevel + 1; level <= newLevel; level++) {
		try {
			await fetch(`${userServiceInternal}/internal/notifications/level-up`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-internal-key': internalKey,
				},
				body: JSON.stringify({
					userId,
					newLevel: level,
					oldLevel: level - 1,
				}),
			});
		} catch {
			// ignore
		}
	}
}

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

		request.log.info({ userId, eventType, eventData }, 'Received achievement event');

		if (!userId || !eventType) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'userId and eventType are required',
			});
		}

		try {
			const newlyUnlocked = await checkAchievements(userId, eventType, eventData || {});
			request.log.info({ userId, eventType, unlockedCount: newlyUnlocked.length }, 'Achievement check complete');
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
			const beforeXP = await getUserXP(userId);
			const oldLevel = beforeXP.level;

			const result = await awardXP(userId, amount, reason, sessionId);

			// notify if level up
			if (result.levelUp) {
				await notifyLevelUp(userId, result.newLevel, oldLevel);
				// check for achievements
				await checkAchievements(userId, 'LEVEL_UP', {
					newLevel: result.newLevel,
					oldLevel,
				});
			}

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
