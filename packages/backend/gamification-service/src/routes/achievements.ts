import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import {
	getAllAchievements,
	getUserAchievements,
	getAchievementProgress,
	checkAchievements,
} from '../services/achievements';

export async function achievementRoutes(fastify: FastifyInstance) {
	// auth middleware
	fastify.addHook('preHandler', authMiddleware);

	// GET all available achievements
	fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
		try {
			const achievements = await getAllAchievements();
			return { achievements };
		} catch (error) {
			request.log.error({ error }, 'Failed to get achievements');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to get achievements',
			});
		}
	});

	// get current user's achievements
	fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			const achievements = await getUserAchievements(userId);
			const allAchievements = await getAllAchievements();

			return {
				unlocked: achievements,
				unlockedCount: achievements.length,
				totalCount: allAchievements.length,
				completionPercentage: Math.round(
					(achievements.length / allAchievements.length) * 100
				),
			};
		} catch (error) {
			request.log.error({ error }, 'Failed to get user achievements');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to get achievements',
			});
		}
	});

	// get specific achievement
	fastify.get<{ Params: { id: string } }>(
		'/:id',
		async (request, reply) => {
			const { id } = request.params;
			const userId = request.user!.userId;

			try {
				const achievements = await getAllAchievements();
				const achievement = achievements.find((a) => a.id === id);

				if (!achievement) {
					return reply.status(404).send({
						statusCode: 404,
						error: 'Not Found',
						message: 'Achievement not found',
					});
				}

				// check user progress
				const userAchievements = await getUserAchievements(userId);
				const isUnlocked = userAchievements.some((ua) => ua.achievementId === id);

				let progress: { progress: number; total: number; percentage: number } | null = null;
				if (!isUnlocked) {
					try {
						progress = await getAchievementProgress(userId, id);
					} catch {
						// if no progress on ach
						progress = null;
					}
				}

				return {
					achievement,
					isUnlocked,
					unlockedAt: isUnlocked
						? userAchievements.find((ua) => ua.achievementId === id)?.unlockedAt
						: null,
					progress,
				};
			} catch (error) {
				request.log.error({ error }, 'Failed to get achievement');
				return reply.status(500).send({
					statusCode: 500,
					error: 'Internal Server Error',
					message: 'Failed to get achievement',
				});
			}
		}
	);

	// get progress for all achievements
	fastify.get('/progress', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			const achievements = await getAllAchievements();
			const userAchievements = await getUserAchievements(userId);
			const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

			const progressList = await Promise.all(
				achievements.map(async (achievement) => {
					if (unlockedIds.has(achievement.id)) {
						return {
							achievementId: achievement.id,
							name: achievement.name,
							isUnlocked: true,
							progress: 100,
						};
					}

					try {
						const progress = await getAchievementProgress(userId, achievement.id);
						return {
							achievementId: achievement.id,
							name: achievement.name,
							isUnlocked: false,
							progress: progress.percentage,
						};
					} catch {
						return {
							achievementId: achievement.id,
							name: achievement.name,
							isUnlocked: false,
							progress: null,
						};
					}
				})
			);

			return { progress: progressList };
		} catch (error) {
			request.log.error({ error }, 'Failed to get achievement progress');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to get achievement progress',
			});
		}
	});

	// check and unlock achievements based on an event
	fastify.post<{
		Body: { userId: string; eventType: string; eventData: Record<string, unknown> };
	}>('/check', async (request, reply) => {
		// only admins can trigger this
		if (request.user!.role !== 'ADMIN') {
			return reply.status(403).send({
				statusCode: 403,
				error: 'Forbidden',
				message: 'Not authorized to check achievements',
			});
		}

		const { userId, eventType, eventData } = request.body;

		if (!userId || !eventType) {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'userId and eventType are required',
			});
		}

		try {
			const unlocked = await checkAchievements(userId, eventType, eventData || {});

			return {
				checked: true,
				newlyUnlocked: unlocked.map((a) => ({
					id: a.id,
					name: a.name,
					description: a.description,
					rarity: a.rarity,
					xpReward: a.xpReward,
				})),
			};
		} catch (error) {
			request.log.error({ error }, 'Failed to check achievements');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to check achievements',
			});
		}
	});

	// recently unlocked achievements global scope
	fastify.get<{ Querystring: { limit?: string } }>(
		'/recent',
		async (request, reply) => {
			const limit = Math.min(parseInt(request.query.limit || '10'), 50);

			try {
				// TODO : db query for this get
				return {
					message: 'Not implemented yet - would show recent global unlocks',
					limit,
				};
			} catch (error) {
				request.log.error({ error }, 'Failed to get recent achievements');
				return reply.status(500).send({
					statusCode: 500,
					error: 'Internal Server Error',
					message: 'Failed to get recent achievements',
				});
			}
		}
	);
}
