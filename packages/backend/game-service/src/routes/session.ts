import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db';
import { authMiddleware } from '../middleware/auth';
import { WebSocketManager } from '../websocket/manager';
import type { ISessionStartRequest, ISessionStartResponse, ISessionHistoryResponse } from '@speak-up/shared';

// shared websocket
let wsManager: WebSocketManager;

export function setWebSocketManager(manager: WebSocketManager) {
	wsManager = manager;
}

export async function sessionRoutes(fastify: FastifyInstance) {
	// auth middleware
	fastify.addHook('preHandler', authMiddleware);

	// start new game session
	fastify.post<{ Body: ISessionStartRequest }>('/start', async (request, reply) => {
		const userId = request.user!.userId;
		const { patientId, mode } = request.body;

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
			const scenarioResult = await query(
				`SELECT scenario_id FROM scenarios ORDER BY scenario_id LIMIT 1`
			);

			if (scenarioResult.rows.length === 0) {
				return reply.status(400).send({
					statusCode: 400,
					error: 'Bad Request',
					message: 'No scenarios available',
				});
			}

			const scenarioId = scenarioResult.rows[0].scenario_id;
			const doctorId = mode === 'AI' ? null : await findAvailableDoctor();

			// Create session
			const sessionId = await wsManager.createSession(scenarioId, patientId, doctorId);

			const response: ISessionStartResponse = {
				sessionId,
				wsUrl: `/ws/game?sessionId=${sessionId}`,
			};

			return response;
		} catch (error) {
			request.log.error({ error }, 'Failed to start session');
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
	fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
		const { id: sessionId } = request.params;
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

				return { state };
			}

			// Load from database if not in memory
			const result = await query(
				`SELECT * FROM sessions WHERE id = $1`,
				[sessionId]
			);

			if (result.rows.length === 0) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'Session not found',
				});
			}

			const dbSession = result.rows[0];

			// Verify access
			if (
				dbSession.patient_id?.toString() !== userId &&
				dbSession.doctor_id?.toString() !== userId &&
				request.user!.role !== 'ADMIN'
			) {
				return reply.status(403).send({
					statusCode: 403,
					error: 'Forbidden',
					message: 'Not authorized to view this session',
				});
			}

			return {
				sessionId: dbSession.id,
				status: dbSession.status,
				mode: dbSession.mode,
				createdAt: dbSession.created_at,
				endedAt: dbSession.ended_at,
				finalMetrics: dbSession.final_metrics,
			};
		} catch (error) {
			request.log.error({ error }, 'Failed to get session');
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
	fastify.get<{ Params: { id: string } }>('/:id/history', async (request, reply) => {
		const { id: sessionId } = request.params;
		const userId = request.user!.userId;

		try {
			// Verify session access
			const sessionResult = await query(
				`SELECT * FROM sessions WHERE id = $1`,
				[sessionId]
			);

			if (sessionResult.rows.length === 0) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'Session not found',
				});
			}

			const session = sessionResult.rows[0];

			if (
				session.patient_id?.toString() !== userId &&
				session.doctor_id?.toString() !== userId &&
				request.user!.role !== 'ADMIN'
			) {
				return reply.status(403).send({
					statusCode: 403,
					error: 'Forbidden',
					message: 'Not authorized to view this session history',
				});
			}

			// Get event log
			const eventsResult = await query(
				`SELECT * FROM event_logs 
				 WHERE session_id = $1 
				 ORDER BY sequence_id ASC`,
				[sessionId]
			);

			const response: ISessionHistoryResponse = {
				sessionId,
				events: eventsResult.rows.map((e) => e.payload),
				finalState: {
					sessionId,
					sequenceId: eventsResult.rows.length,
					lastUpdateTimestamp: session.ended_at || session.updated_at,
					status: session.status,
					metrics: session.final_metrics || {
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
							userId: session.patient_id?.toString() || '',
							connectionStatus: 'OFFLINE',
							lastAckSequenceId: 0,
							currentActivity: 'IDLE',
						},
						doctor: {
							userId: session.doctor_id?.toString() || 'AI_DOCTOR',
							connectionStatus: 'OFFLINE',
							lastAckSequenceId: 0,
							currentActivity: 'IDLE',
						},
					},
				},
			};

			return response;
		} catch (error) {
			request.log.error({ error }, 'Failed to get session history');
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
	fastify.post<{ Params: { id: string }; Body: { reason?: string } }>(
		'/:id/surrender',
		async (request, reply) => {
			const { id: sessionId } = request.params;
			const userId = request.user!.userId;
			const { reason } = request.body;

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

				return { success: true, message: 'Session ended' };
			} catch (error) {
				request.log.error({ error }, 'Failed to surrender session');
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
		const userId = request.user!.userId;

		try {
			const result = await query(
				`SELECT id, mode, status, created_at 
				 FROM sessions 
				 WHERE (patient_id = $1 OR doctor_id = $1)
				   AND status IN ('WAITING', 'ACTIVE', 'PAUSED')
				 ORDER BY created_at DESC`,
				[userId]
			);

			return {
				sessions: result.rows.map((s) => ({
					sessionId: s.id,
					mode: s.mode,
					status: s.status,
					createdAt: s.created_at,
				})),
			};
		} catch (error) {
			request.log.error({ error }, 'Failed to list active sessions');
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
	const result = await query(
		`SELECT u.user_id 
		 FROM users u
		 WHERE u.user_role = 'DOCTOR'
		   AND NOT EXISTS (
			 SELECT 1 FROM sessions s 
			 WHERE s.doctor_id = u.user_id 
			   AND s.status IN ('WAITING', 'ACTIVE', 'PAUSED')
		   )
		 LIMIT 1`
	);

	return result.rows[0]?.user_id?.toString() || null;
}
