import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function gdprRoutes(fastify: FastifyInstance) {
	// apply auth middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// gdpr compliance: export all userdata
	fastify.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			// fetch user with all related data
			const user = await prisma.user.findUnique({
				where: {id: userId},
				include: {
					settings: true,
					oauth: true,
					patientSessions: {
						orderBy: {createdAt: 'desc'},
					},
					doctorSessions: {
						orderBy: {createdAt: 'desc'},
					},
					friendsInitiated: true,
					friendsReceived: true,
				},
			});

			if (!user) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'User not found',
				});
			}

			// combine sessions
			const allSessions = [...(user.patientSessions || []), ...(user.doctorSessions || [])];

			// combine friends
			const friends = [
				...(user.friendsInitiated || []).map((f) => ({
					userId: f.receiverId.toString(),
					status: f.status,
					since: f.createdAt,
				})),
				...(user.friendsReceived || []).map((f) => ({
					userId: f.initiatorId.toString(),
					status: f.status,
					since: f.createdAt,
				})),
			];

			// compile export data
			const exportData = {
				exportedAt: new Date().toISOString(),
				user: {
					id: user.id.toString(),
					username: user.username,
					email: user.email,
					role: user.role,
					dateOfBirth: user.dob,
					createdAt: user.createdAt,
					lastModified: user.updatedAt,
				},
				settings: user.settings ? {
					avatar: user.settings.avatar,
					colour: user.settings.colour,
					locale: user.settings.locale,
				} : {},
				sessions: allSessions.map((s) => ({
					id: s.id.toString(),
					scenarioId: s.scenarioId?.toString(),
					mode: s.mode,
					status: s.status,
					createdAt: s.createdAt,
					endedAt: s.endedAt,
					metrics: s.finalMetrics,
				})),
				friends,
				oauthConnections: user.oauth ? [{
					provider: user.oauth.provider,
					connectedAt: user.oauth.createdAt,
				}] : [],
			};

			// set headers for file download
			reply.header('Content-Type', 'application/json');
			reply.header('Content-Disposition', `attachment; filename="user_data_${userId}.json"`);

			return exportData;
		} catch (error) {
			request.log.error({error}, 'Failed to export user data');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to export user data',
			});
		}
	});

	// export userdata in csv
	fastify.get('/export/csv', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const sessions = await prisma.session.findMany({
				where: {patientId: userId},
				orderBy: {createdAt: 'desc'},
			});

			// generate CSV
			const headers = ['Session ID', 'Scenario ID', 'Mode', 'Status', 'Created', 'Ended', 'Trust', 'Stress'];
			const rows = sessions.map((s) => {
				const metrics = s.finalMetrics as Record<string, unknown> | null;
				return [
					s.id.toString(),
					s.scenarioId?.toString() || '',
					s.mode,
					s.status,
					s.createdAt.toISOString(),
					s.endedAt?.toISOString() || '',
					(metrics?.trust as string) || '',
					(metrics?.stress as string) || '',
				];
			});

			const csv = [
				headers.join(','),
				...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
			].join('\n');

			reply.header('Content-Type', 'text/csv');
			reply.header('Content-Disposition', `attachment; filename="sessions_${userId}.csv"`);

			return csv;
		} catch (error) {
			request.log.error({error}, 'Failed to export CSV');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to export data',
			});
		}
	});

	// request account deletion
	fastify.delete('/delete', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			// use prisma transaction
			await prisma.$transaction(async (tx) => {
				// anonymize sessions
				await tx.session.updateMany({
					where: {patientId: userId},
					data: {patientId: null as unknown as bigint},
				});
				await tx.session.updateMany({
					where: {doctorId: userId},
					data: {doctorId: null as unknown as bigint},
				});

				// scrub event logs
				await tx.eventLog.updateMany({
					where: {emitterId: userId},
					data: {
						payload: {scrubbed: true},
						emitterId: null as unknown as bigint,
					},
				});

				// delete OAuth connections
				await tx.oAuth.deleteMany({
					where: {userId},
				});

				// delete settings
				await tx.settings.deleteMany({
					where: {userId},
				});

				// delete tokens
				await tx.userKey.deleteMany({
					where: {userId},
				});

				// delete friendships
				await tx.friend.deleteMany({
					where: {
						OR: [
							{initiatorId: userId},
							{receiverId: userId},
						],
					},
				});

				// delete pong stats
				await tx.gamePong.deleteMany({
					where: {playerId: userId},
				});

				// delete breathe stats
				await tx.gameBreathe.deleteMany({
					where: {playerId: userId},
				});

				// final -> delete the user
				await tx.user.delete({
					where: {id: userId},
				});
			});

			request.log.info({userId: userId.toString()}, 'User account deleted (GDPR request)');

			return {
				success: true,
				message:	'Your account and personal data have been deleted. Some anonymized data may be retained for statistical purposes.',
			};
		} catch (error) {
			request.log.error({error}, 'Failed to delete account');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to delete account',
			});
		}
	});

	// submit a data request
	fastify.post<{Body: {type: 'export' | 'delete' | 'rectify'; details?: string}}>(
		'/request',
		async (request, reply) => {
			const userId = request.user!.userId;
			const {type, details} = request.body;

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
					message:	`Your ${type} request has been received. You will receive a confirmation email within 30 days as required by GDPR.`,
					requestId: `GDPR-${Date.now()}-${userId}`,
				};
			} catch (error) {
				request.log.error({error}, 'Failed to process GDPR request');
				return reply.status(500).send({
					statusCode:	500,
					error:		'Internal Server Error',
					message:	'Failed to process request',
				});
			}
		}
	);
}

export async function importRoutes(fastify: FastifyInstance) {
	// apply auth middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// import user data from file
	fastify.post<{Body: {file: any}}>('/import', async (request, reply) => {
		const userId = BigInt(request.user!.userId);

		try {
			// get the uploaded file
			const data = await request.file();

			if (!data) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'No file uploaded',
				});
			}

			// read file buffer
			const buffer = await data.toBuffer();
			const fileContent = buffer.toString('utf-8');

			// detect format and parse
			let importData: any;
			try {
				importData = JSON.parse(fileContent);
			} catch {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Invalid JSON file format',
				});
			}

			// validate file structure
			if (!importData.user) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Invalid data structure - missing user field',
				});
			}

			let processed = 0;
			let updated = 0;
			let skipped = 0;
			const errors: string[] = [];

			try {
				// start transaction for data import
				await prisma.$transaction(async (tx) => {
					// update user basic info
					if (importData.user.username || importData.user.email) {
						await tx.user.update({
							where: {id: userId},
							data: {
								...(importData.user.username && {username: importData.user.username}),
								...(importData.user.email && {email: importData.user.email}),
							},
						});
						updated++;
						processed++;
					}

					// update settings if provided
					if (importData.settings) {
						const settings = importData.settings;
						await tx.settings.upsert({
							where: {userId},
							update: {
								...(settings.avatar && {avatar: settings.avatar}),
								...(settings.colour && {colour: settings.colour}),
								...(settings.locale && {locale: settings.locale}),
							},
							create: {
								userId,
								avatar: settings.avatar || '',
								colour: settings.colour || '#000000',
								locale: settings.locale || 'en',
							},
						});
						updated++;
						processed++;
					}

					// import friends if provided
					if (importData.friends && Array.isArray(importData.friends)) {
						for (const friend of importData.friends) {
							try {
								const friendId = BigInt(friend.userId);
								// create friend relationship
								const existing = await tx.friend.findFirst({
									where: {
										OR: [
											{initiatorId: userId, receiverId: friendId},
											{initiatorId: friendId, receiverId: userId},
										],
									},
								});

								if (!existing) {
									await tx.friend.create({
										data: {
											initiatorId: userId,
											receiverId: friendId,
											status: friend.status || 'PENDING',
										},
									});
									processed++;
									updated++;
								} else {
									skipped++;
								}
							} catch (err) {
								errors.push(`Failed to import friend ${friend.userId}`);
								skipped++;
							}
						}
					}
				});

				request.log.info({userId: userId.toString(), processed, updated, skipped}, 'User data imported');

				return {
					success: true,
					message:	'Data imported successfully',
					processed,
					updated,
					skipped,
					errors: errors.length > 0 ? errors : undefined,
				};
			} catch (error) {
				request.log.error({error}, 'Failed to import data');
				return reply.status(500).send({
					statusCode:	500,
					error:		'Internal Server Error',
					message:	'Failed to import data',
				});
			}
		} catch (error) {
			request.log.error({error}, 'Failed to process file upload');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to process file upload',
			});
		}
	});
}
