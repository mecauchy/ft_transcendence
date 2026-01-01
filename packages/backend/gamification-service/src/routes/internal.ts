import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';
import {checkAchievements} from '../services/achievements';

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
}
