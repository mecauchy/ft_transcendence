import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import {WebSocketManager} from '../websocket/manager';
import type {ISessionStartRequest, ISessionStartResponse, ISessionHistoryResponse, GameEvent} from '@speak-up/shared';

// shared websocket
let wsManager: WebSocketManager;

export function setWebSocketManager(manager: WebSocketManager) {
	wsManager = manager;
}

export async function sessionRoutes(fastify: FastifyInstance) {
	// auth middleware
	fastify.addHook('preHandler', authMiddleware);

	// start new game session
	fastify.post<{Body: ISessionStartRequest}>('/start', async (request, reply) => {
		const userId = request.user!.userId;
		const {patientId, mode} = request.body;

		// validate request
		if (patientId !== userId) {
			return reply.status(403).send({
				statusCode: 403,
				error: 'Forbidden',
				message: 'Can only start sessions for yourself',
			});
		}

		try {
			// default scenario (or specific one if provided)
			const scenario = await prisma.scenario.findFirst({
				orderBy: {id: 'asc'},
			});

			if (!scenario) {
				return reply.status(400).send({
					statusCode: 400,
					error: 'Bad Request',
					message: 'No scenarios available',
				});
			}

			const scenarioId = scenario.id.toString();
			const doctorId = mode === 'AI' ? null : await findAvailableDoctor();

			// Create session
			const sessionId = await wsManager.createSession(scenarioId, patientId, doctorId);

			const response: ISessionStartResponse = {
				sessionId,
				wsUrl: `/ws/game?sessionId=${sessionId}`,
			};

			return response;
		} catch (error) {
			request.log.error({error}, 'Failed to start session');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to start session',
			});
		}
	});

	/**
	 * GET /api/session/:id
	 * Get current session state
	 */
	fastify.get<{Params: {id: string}}>('/:id', async (request, reply) => {
		const {id: sessionId} = request.params;
		const userId = request.user!.userId;

		try {
			// Check if session exists in memory
			const session = wsManager.getSession(sessionId);
			
			if (session) {
				const state = session.engine.getState();
				
				// Verify user is participant or admin
				if (
					state.participants.patient.userId !== userId &&
					state.participants.doctor.userId !== userId &&
					request.user!.role !== 'ADMIN'
				) {
					return reply.status(403).send({
						statusCode: 403,
						error: 'Forbidden',
						message: 'Not authorized to view this session',
					});
				}

				return {state};
			}

			// Load from database if not in memory
			const dbSession = await prisma.session.findUnique({
				where: {id: sessionId},
			});

			if (!dbSession) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'Session not found',
				});
			}

			// Verify access
			if (
				dbSession.patientId?.toString() !== userId &&
				dbSession.doctorId?.toString() !== userId &&
				request.user!.role !== 'ADMIN'
			) {
				return reply.status(403).send({
					statusCode: 403,
					error: 'Forbidden',
					message: 'Not authorized to view this session',
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
		} catch (error) {
			request.log.error({error}, 'Failed to get session');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to get session',
			});
		}
	});

	/**
	 * GET /api/session/:id/history
	 * Get session event history (for replay/analysis)
	 */
	fastify.get<{Params: {id: string}}>('/:id/history', async (request, reply) => {
		const {id: sessionId} = request.params;
		const userId = request.user!.userId;

		try {
			// Verify session access
			const session = await prisma.session.findUnique({
				where: {id: sessionId},
			});

			if (!session) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'Session not found',
				});
			}

			if (
				session.patientId?.toString() !== userId &&
				session.doctorId?.toString() !== userId &&
				request.user!.role !== 'ADMIN'
			) {
				return reply.status(403).send({
					statusCode: 403,
					error: 'Forbidden',
					message: 'Not authorized to view this session history',
				});
			}

			// Get event log
			const events = await prisma.eventLog.findMany({
				where: {sessionId: sessionId},
				orderBy: {sequenceId: 'asc'},
			});

			const response: ISessionHistoryResponse = {
				sessionId,
				events: events.map((e) => e.payload as unknown as GameEvent),
				finalState: {
					sessionId,
					sequenceId: events.length,
					lastUpdateTimestamp: (session.endedAt || session.updatedAt).getTime(),
					status: session.status,
					metrics: (session.finalMetrics as {trust: number; stress: number; compliance: number; mood: 'CALM' | 'ANXIOUS' | 'DEFENSIVE' | 'BREAKTHROUGH'}) || {
						trust: 0,
						stress: 0,
						compliance: 0,
						mood: 'CALM',
					},
					actionNodeId: 'END',
					narrativeFlags: {},
					inventory: [],
					participants: {
						patient: {
							userId: session.patientId?.toString() || '',
							connectionStatus: 'OFFLINE',
							lastAckSequenceId: 0,
							currentActivity: 'IDLE',
						},
						doctor: {
							userId: session.doctorId?.toString() || 'AI_DOCTOR',
							connectionStatus: 'OFFLINE',
							lastAckSequenceId: 0,
							currentActivity: 'IDLE',
						},
					},
				},
			};

			return response;
		} catch (error) {
			request.log.error({error}, 'Failed to get session history');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to get session history',
			});
		}
	});

	/**
	 * POST /api/session/:id/surrender
	 * End session early (patient gives up)
	 */
	fastify.post<{Params: {id: string}; Body: {reason?: string}}>(
		'/:id/surrender',
		async (request, reply) => {
			const {id: sessionId} = request.params;
			const userId = request.user!.userId;
			const {reason} = request.body;

			try {
				const session = wsManager.getSession(sessionId);

				if (!session) {
					return reply.status(404).send({
						statusCode: 404,
						error: 'Not Found',
						message: 'Active session not found',
					});
				}

				const state = session.engine.getState();

				// Only patient can surrender
				if (state.participants.patient.userId !== userId) {
					return reply.status(403).send({
						statusCode: 403,
						error: 'Forbidden',
						message: 'Only the patient can surrender',
					});
				}

				// Terminate session
				session.engine.terminate(reason || 'Player surrendered');

				return {success: true, message: 'Session ended'};
			} catch (error) {
				request.log.error({error}, 'Failed to surrender session');
				return reply.status(500).send({
					statusCode: 500,
					error: 'Internal Server Error',
					message: 'Failed to end session',
				});
			}
		}
	);

	/**
	 * GET /api/session/active
	 * List user's active sessions
	 */
	fastify.get('/active', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const sessions = await prisma.session.findMany({
				where: {
					OR: [
						{patientId: userId},
						{doctorId: userId},
					],
					status: {in: ['WAITING', 'ACTIVE', 'PAUSED']},
				},
				orderBy: {createdAt: 'desc'},
			});

			return {
				sessions: sessions.map((s) => ({
					sessionId: s.id.toString(),
					mode: s.mode,
					status: s.status,
					createdAt: s.createdAt,
				})),
			};
		} catch (error) {
			request.log.error({error}, 'Failed to list active sessions');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to list sessions',
			});
		}
	});
}

/**
 * Find an available doctor for P2P matchmaking
 */
async function findAvailableDoctor(): Promise<string | null> {
	// Simple implementation: find online user with DOCTOR role
	// In production, this would use a matchmaking queue
	const doctor = await prisma.user.findFirst({
		where: {
			role: 'DOCTOR',
			NOT: {
				doctorSessions: {
					some: {
						status: {in: ['WAITING', 'ACTIVE']},
					},
				},
			},
		},
	});

	return doctor?.id.toString() || null;
}
