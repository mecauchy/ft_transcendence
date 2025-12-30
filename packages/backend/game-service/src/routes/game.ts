import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import {WebSocketManager} from '../websocket/manager';
import type {IPongGame} from '@speak-up/shared';

// shared websocket
let wsManager: WebSocketManager;

export function setWebSocketManager(manager: WebSocketManager) {
	wsManager = manager;
}

export async function gameRoutes(fastify: FastifyInstance) {
	// auth middleware
	fastify.addHook('preHandler', authMiddleware);

	// receive data from pong game
	fastify.post<{Body: IPongGame}>('/start', async (request, reply) => {
		const userId = request.user!.userId;

		// validate request
		if (request.playerid !== userId) {
			return reply.status(403).send({
				statusCode:	403,
				error:		'Forbidden',
				message:	'Can only send stats for yourself',
			});
		}

		try {
			// Store game stats in DB
			const {
				mode,
				difficulty,
				score1,
				score2,
				winner,
				timestamp
			} = request.body;

			const gameLog = await prisma.pongGame.create({
				data: {
					playerId: userId,
					mode,
					difficulty,
					score1,
					score2,
					winner,
					timestamp: new Date(timestamp)
				}
			});

			return reply.send({
				success: true,
				gameId: gameLog.id
			});

			return ;
		} catch (error) {
			request.log.error({error}, 'Failed to log game');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to start session',
			});
		}
	});

	/*
	// get pong stats
	fastify.get<{Params: {id: string}}>('/:id', async (request, reply) => {
		const {id: sessionId} = request.params;
		const userId = request.user!.userId;

		try {
				// verify if user participant of session or admin
				try {
					// Store game stats in DB
					const {
						mode,
						difficulty,
						score1,
						score2,
						winner,
						timestamp
					} = request.body;

					const gameLog = await prisma.pongGame.create({
						data: {
							playerId: userId,
							mode,
							difficulty,
							score1,
							score2,
							winner,
							timestamp: new Date(timestamp)
						}
					});

					return reply.send({
						success: true,
						gameId: gameLog.id
					});
				} catch (error) {
					request.log.error({error}, 'Failed to log game');
					return reply.status(500).send({
						statusCode: 500,
						error: 'Internal Server Error',
						message: 'Failed to log game',
					});
				}
				return {state};
			}

			// load from db if not in memory
			const dbSession = await prisma.session.findUnique({
				where: {id: sessionId},
			});

			if (!dbSession) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'Session not found',
				});
			}

			// verify access
			if (
				dbSession.patientId?.toString() !== userId &&
				dbSession.doctorId?.toString() !== userId &&
				request.user!.role !== 'ADMIN'
			) {
				return reply.status(403).send({
					statusCode:	403,
					error:		'Forbidden',
					message:	'Not authorized to view this session',
				});
			}

			return {
				sessionId: dbSession.id.toString(),
				status: dbSession.status,
				mode: dbSession.mode,
				createdAt: dbSession.createdAt,
				endedAt: dbSession.endedAt,
				finalMetrics: dbSession.finalMetrics,
			};
	});
	*/

}

