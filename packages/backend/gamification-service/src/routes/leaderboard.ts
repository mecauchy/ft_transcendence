import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {authMiddleware} from '../middleware/auth';
import {
	getGlobalLeaderboard,
	getScenarioLeaderboard,
	getFriendsLeaderboard,
	getUserRank,
	LeaderboardType,
} from '../services/leaderboard';

export async function leaderboardRoutes(fastify: FastifyInstance) {
	// auth middleware
	fastify.addHook('preHandler', authMiddleware);

	// get global LB
	fastify.get<{
		Querystring: {type?: string; limit?: string; offset?: string};
	}>('/', async (request, reply) => {
		const type = (request.query.type || 'XP').toUpperCase() as LeaderboardType;
		const limit = Math.min(parseInt(request.query.limit || '100'), 500);
		const offset = parseInt(request.query.offset || '0');

		const validTypes: LeaderboardType[] = ['XP', 'LEVEL', 'SESSIONS', 'ACHIEVEMENTS'];
		if (!validTypes.includes(type)) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: `Invalid leaderboard type. Valid types: ${validTypes.join(', ')}`,
			});
		}

		try {
			const entries = await getGlobalLeaderboard(type, limit, offset);
			const userRank = await getUserRank(request.user!.userId, type);

			return {
				type,
				entries,
				total: entries.length,
				userRank,
			};
		} catch (error) {
			request.log.error({error}, 'Failed to get leaderboard');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to get leaderboard',
			});
		}
	});

	// get lb for specific scenario
	fastify.get<{
		Params: {scenarioId: string};
		Querystring: {limit?: string; offset?: string};
	}>('/scenario/:scenarioId', async (request, reply) => {
		const {scenarioId} = request.params;
		const limit = Math.min(parseInt(request.query.limit || '100'), 500);
		const offset = parseInt(request.query.offset || '0');

		try {
			const entries = await getScenarioLeaderboard(scenarioId, limit, offset);

			return {
				scenarioId,
				entries,
				total: entries.length,
			};
		} catch (error) {
			request.log.error({error}, 'Failed to get scenario leaderboard');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to get scenario leaderboard',
			});
		}
	});

	// get lb among friends
	fastify.get<{Querystring: {limit?: string}}>(
		'/friends',
		async (request, reply) => {
			const userId = request.user!.userId;
			const limit = Math.min(parseInt(request.query.limit || '50'), 100);

			try {
				const entries = await getFriendsLeaderboard(userId, limit);

				return {
					entries,
					total: entries.length,
				};
			} catch (error) {
				request.log.error({error}, 'Failed to get friends leaderboard');
				return reply.status(500).send({
					statusCode: 500,
					error: 'Internal Server Error',
					message: 'Failed to get friends leaderboard',
				});
			}
		}
	);

	// current user rank + surrounding rank
	fastify.get<{Querystring: {type?: string}}>(
		'/me',
		async (request, reply) => {
			const userId = request.user!.userId;
			const type = (request.query.type || 'XP').toUpperCase() as LeaderboardType;

			try {
				const userRank = await getUserRank(userId, type);

				// get players surrounding
				const offset = Math.max(0, userRank - 5);
				const entries = await getGlobalLeaderboard(type, 10, offset);

				return {
					type,
					userRank,
					surroundingPlayers: entries,
				};
			} catch (error) {
				request.log.error({error}, 'Failed to get user rank');
				return reply.status(500).send({
					statusCode: 500,
					error: 'Internal Server Error',
					message: 'Failed to get user rank',
				});
			}
		}
	);
}
