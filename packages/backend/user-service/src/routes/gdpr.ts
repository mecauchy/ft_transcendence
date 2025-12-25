import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, transaction } from '../db';
import { authMiddleware } from '../middleware/auth';

export async function gdprRoutes(fastify: FastifyInstance) {
	// apply auth middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// gdpr compliance: export all userdata
	fastify.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			// fetch profile
			const userResult = await query(
				`SELECT user_id, user_username, user_email, user_role, 
						user_dob, user_creation_date, user_modification_date
				FROM users WHERE user_id = $1`,
				[userId]
			);

			if (userResult.rows.length === 0) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'User not found',
				});
			}

			// fetch settings
			const settingsResult = await query(
				`SELECT settings_avatar, settings_colour, settings_locale
				FROM settings WHERE settings_userid = $1`,
				[userId]
			);

			// fetch sessions
			const sessionsResult = await query(
				`SELECT id, scenario_id, mode, status, created_at, ended_at, final_metrics
				FROM sessions WHERE patient_id = $1 OR doctor_id = $1
				ORDER BY created_at DESC`,
				[userId]
			);

			// fetch friends
			const friendsResult = await query(
				`SELECT 
					CASE WHEN f.friend_id = $1 THEN f.friend_userid ELSE f.friend_id END as friend_user_id,
					f.friend_status, f.friend_creation_date
				FROM friends f
				WHERE f.friend_id = $1 OR f.friend_userid = $1`,
				[userId]
			);

			// fetch OAuth connections
			const oauthResult = await query(
				`SELECT oauth_provider, oauth_creation_date
				 FROM oauth WHERE oauth_userid = $1`,
				[userId]
			);

			// compile export data
			const exportData = {
				exportedAt: new Date().toISOString(),
				user: {
					id: userResult.rows[0].user_id,
					username: userResult.rows[0].user_username,
					email: userResult.rows[0].user_email,
					role: userResult.rows[0].user_role,
					dateOfBirth: userResult.rows[0].user_dob,
					createdAt: userResult.rows[0].user_creation_date,
					lastModified: userResult.rows[0].user_modification_date,
				},
				settings: settingsResult.rows[0] || {},
				sessions: sessionsResult.rows.map((s) => ({
					id: s.id,
					scenarioId: s.scenario_id,
					mode: s.mode,
					status: s.status,
					createdAt: s.created_at,
					endedAt: s.ended_at,
					metrics: s.final_metrics,
				})),
				friends: friendsResult.rows.map((f) => ({
					userId: f.friend_user_id,
					status: f.friend_status,
					since: f.friend_creation_date,
				})),
				oauthConnections: oauthResult.rows.map((o) => ({
					provider: o.oauth_provider,
					connectedAt: o.oauth_creation_date,
				})),
			};

			// set headers for file download
			reply.header('Content-Type', 'application/json');
			reply.header('Content-Disposition', `attachment; filename="user_data_${userId}.json"`);

			return exportData;
		} catch (error) {
			request.log.error({ error }, 'Failed to export user data');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to export user data',
			});
		}
	});

	// export userdata in csv
	fastify.get('/export/csv', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			const sessionsResult = await query(
				`SELECT id, scenario_id, mode, status, created_at, ended_at,
						final_metrics->>'trust' as trust,
						final_metrics->>'stress' as stress
				FROM sessions WHERE patient_id = $1
				ORDER BY created_at DESC`,
				[userId]
			);

			// generate CSV
			const headers = ['Session ID', 'Scenario ID', 'Mode', 'Status', 'Created', 'Ended', 'Trust', 'Stress'];
			const rows = sessionsResult.rows.map((s) => [
				s.id,
				s.scenario_id || '',
				s.mode,
				s.status,
				s.created_at,
				s.ended_at || '',
				s.trust || '',
				s.stress || '',
			]);

			const csv = [
				headers.join(','),
				...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
			].join('\n');

			reply.header('Content-Type', 'text/csv');
			reply.header('Content-Disposition', `attachment; filename="sessions_${userId}.csv"`);

			return csv;
		} catch (error) {
			request.log.error({ error }, 'Failed to export CSV');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to export data',
			});
		}
	});

	// request account deletion
	fastify.delete('/delete', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			await transaction(async (txQuery) => {
				// anonymous session
				await txQuery(
					`UPDATE sessions SET patient_id = NULL WHERE patient_id = $1`,
					[userId]
				);
				await txQuery(
					`UPDATE sessions SET doctor_id = NULL WHERE doctor_id = $1`,
					[userId]
				);

				// remove event logs
				await txQuery(
					`UPDATE event_logs SET payload = '{"scrubbed": true}'::jsonb 
					 WHERE emitter_id = $1`,
					[userId]
				);
				await txQuery(
					`UPDATE event_logs SET emitter_id = NULL WHERE emitter_id = $1`,
					[userId]
				);

				// delete OAuth connections
				await txQuery(
					`DELETE FROM oauth WHERE oauth_userid = $1`,
					[userId]
				);

				// delete settings
				await txQuery(
					`DELETE FROM settings WHERE settings_userid = $1`,
					[userId]
				);

				// delete tokens
				await txQuery(
					`DELETE FROM user_keys WHERE key_userid = $1`,
					[userId]
				);

				// delete friendships
				await txQuery(
					`DELETE FROM friends WHERE friend_id = $1 OR friend_userid = $1`,
					[userId]
				);

				// final -> delete the user
				await txQuery(
					`DELETE FROM users WHERE user_id = $1`,
					[userId]
				);
			});

			request.log.info({ userId }, 'User account deleted (GDPR request)');

			return {
				success: true,
				message: 'Your account and personal data have been deleted. Some anonymized data may be retained for statistical purposes.',
			};
		} catch (error) {
			request.log.error({ error }, 'Failed to delete account');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to delete account',
			});
		}
	});

	// submit a data request
	fastify.post<{ Body: { type: 'export' | 'delete' | 'rectify'; details?: string } }>(
		'/request',
		async (request, reply) => {
			const userId = request.user!.userId;
			const { type, details } = request.body;

			try {
				// log request for compliance
				request.log.info({
					userId,
					requestType: type,
					details,
					timestamp: new Date().toISOString(),
				}, 'GDPR data request received');

				// here usually it would send a mail or open a ticket, we can log it perhaps and simulate (TODO)

				return {
					success: true,
					message: `Your ${type} request has been received. You will receive a confirmation email within 30 days as required by GDPR.`,
					requestId: `GDPR-${Date.now()}-${userId}`,
				};
			} catch (error) {
				request.log.error({ error }, 'Failed to process GDPR request');
				return reply.status(500).send({
					statusCode: 500,
					error: 'Internal Server Error',
					message: 'Failed to process request',
				});
			}
		}
	);
}
