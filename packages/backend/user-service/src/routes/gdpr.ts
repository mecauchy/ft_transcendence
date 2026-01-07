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
					friendsInitiated: true,
					friendsReceived: true,
					achievements: {
						include: {
							achievement: true,
						},
					},
					sentMessages: {
						orderBy: {createdAt: 'desc'},
						select: {
							id: true,
							content: true,
							receiverId: true,
							createdAt: true,
							isRead: true,
						},
					},
					receivedMessages: {
						orderBy: {createdAt: 'desc'},
						select: {
							id: true,
							content: true,
							senderId: true,
							createdAt: true,
							isRead: true,
						},
					},
				},
			});

			if (!user) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'User not found',
				});
			}

			// fetch game history
			const pongGames = await prisma.gamePong.findMany({
				where: {playerId: userId},
				orderBy: {startedAt: 'desc'},
			});

			const breatheGames = await prisma.gameBreathe.findMany({
				where: {playerId: userId},
				orderBy: {startedAt: 'desc'},
			});

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
				gamification: {
					totalXp: user.totalXp,
					currentLevel: user.currentLevel,
					stressLevel: user.stressLevel,
					confidenceLevel: user.confidenceLevel,
				},
				achievements: user.achievements.map((ua) => ({
					id: ua.id,
					code: ua.achievement.code,
					name: ua.achievement.name,
					description: ua.achievement.description,
					xpReward: ua.achievement.xpReward,
					rarity: ua.achievement.rarity,
					category: ua.achievement.category,
					unlockedAt: ua.unlockedAt,
				})),
				settings: user.settings ? {
					avatar: user.settings.avatar,
					colour: user.settings.colour,
					locale: user.settings.locale,
				} : {},
				gameHistory: {
					pong: pongGames.map((g) => ({
						id: g.id.toString(),
						mode: g.mode,
						difficulty: g.difficulty,
						score1: g.score1,
						score2: g.score2,
						winner: g.winner,
						startedAt: g.startedAt,
						endedAt: g.endedAt,
					})),
					breathe: breatheGames.map((g) => ({
						id: g.id.toString(),
						startedAt: g.startedAt,
						endedAt: g.endedAt,
					})),
				},
				friends,
				chatHistory: {
					messagesSent: user.sentMessages.map((m) => ({
						id: m.id,
						content: m.content,
						receiverId: m.receiverId.toString(),
						createdAt: m.createdAt,
						isRead: m.isRead,
					})),
					messagesReceived: user.receivedMessages.map((m) => ({
						id: m.id,
						content: m.content,
						senderId: m.senderId.toString(),
						createdAt: m.createdAt,
						isRead: m.isRead,
					})),
				},
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

	// export game history in csv
	fastify.get('/export/csv', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const pongGames = await prisma.gamePong.findMany({
				where: {playerId: userId},
				orderBy: {startedAt: 'desc'},
			});

			// generate CSV for pong games
			const headers = ['Game ID', 'Mode', 'Difficulty', 'Your Score', 'Opponent Score', 'Winner', 'Started', 'Ended'];
			const rows = pongGames.map((g) => {
				return [
					g.id.toString(),
					g.mode,
					g.difficulty,
					g.score1.toString(),
					g.score2.toString(),
					g.winner,
					g.startedAt?.toISOString() || '',
					g.endedAt?.toISOString() || '',
				];
			});

			const csv = [
				headers.join(','),
				...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
			].join('\n');

			reply.header('Content-Type', 'text/csv');
			reply.header('Content-Disposition', `attachment; filename="pong_history_${userId}.csv"`);

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

	// export userdata in xml
	fastify.get('/export/xml', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			// fetch user with all related data
			const user = await prisma.user.findUnique({
				where: {id: userId},
				include: {
					settings: true,
					oauth: true,
					friendsInitiated: true,
					friendsReceived: true,
					achievements: {
						include: {
							achievement: true,
						},
					},
					sentMessages: {
						orderBy: {createdAt: 'desc'},
						select: {
							id: true,
							content: true,
							receiverId: true,
							createdAt: true,
							isRead: true,
						},
					},
					receivedMessages: {
						orderBy: {createdAt: 'desc'},
						select: {
							id: true,
							content: true,
							senderId: true,
							createdAt: true,
							isRead: true,
						},
					},
				},
			});

			if (!user) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'User not found',
				});
			}

			// fetch game history
			const pongGames = await prisma.gamePong.findMany({
				where: {playerId: userId},
				orderBy: {startedAt: 'desc'},
			});

			const breatheGames = await prisma.gameBreathe.findMany({
				where: {playerId: userId},
				orderBy: {startedAt: 'desc'},
			});

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

			// build XML
			const escapeXml = (str: string) => str
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&apos;');

			let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
			xml += '<userData>\n';
			xml += `  <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
			xml += '  <user>\n';
			xml += `    <id>${user.id.toString()}</id>\n`;
			xml += `    <username>${escapeXml(user.username)}</username>\n`;
			xml += `    <email>${escapeXml(user.email)}</email>\n`;
			xml += `    <role>${user.role}</role>\n`;
			xml += `    <dateOfBirth>${user.dob?.toISOString() || ''}</dateOfBirth>\n`;
			xml += `    <createdAt>${user.createdAt.toISOString()}</createdAt>\n`;
			xml += `    <lastModified>${user.updatedAt.toISOString()}</lastModified>\n`;
			xml += '  </user>\n';

			// gamification data
			xml += '  <gamification>\n';
			xml += `    <totalXp>${user.totalXp}</totalXp>\n`;
			xml += `    <currentLevel>${user.currentLevel}</currentLevel>\n`;
			xml += `    <stressLevel>${user.stressLevel}</stressLevel>\n`;
			xml += `    <confidenceLevel>${user.confidenceLevel}</confidenceLevel>\n`;
			xml += '  </gamification>\n';

			// achievements
			xml += '  <achievements>\n';
			for (const ua of user.achievements) {
				xml += '    <achievement>\n';
				xml += `      <id>${ua.id}</id>\n`;
				xml += `      <code>${escapeXml(ua.achievement.code)}</code>\n`;
				xml += `      <name>${escapeXml(ua.achievement.name)}</name>\n`;
				xml += `      <description>${escapeXml(ua.achievement.description)}</description>\n`;
				xml += `      <xpReward>${ua.achievement.xpReward}</xpReward>\n`;
				xml += `      <rarity>${ua.achievement.rarity}</rarity>\n`;
				xml += `      <category>${escapeXml(ua.achievement.category)}</category>\n`;
				xml += `      <unlockedAt>${ua.unlockedAt.toISOString()}</unlockedAt>\n`;
				xml += '    </achievement>\n';
			}
			xml += '  </achievements>\n';
			
			if (user.settings) {
				xml += '  <settings>\n';
				xml += `    <avatar>${escapeXml(user.settings.avatar || '')}</avatar>\n`;
				xml += `    <colour>${escapeXml(user.settings.colour || '')}</colour>\n`;
				xml += `    <locale>${escapeXml(user.settings.locale || 'en')}</locale>\n`;
				xml += '  </settings>\n';
			}
			
			xml += '  <gameHistory>\n';
			xml += '    <pongGames>\n';
			for (const g of pongGames) {
				xml += '      <game>\n';
				xml += `        <id>${g.id.toString()}</id>\n`;
				xml += `        <mode>${g.mode}</mode>\n`;
				xml += `        <difficulty>${g.difficulty}</difficulty>\n`;
				xml += `        <score1>${g.score1}</score1>\n`;
				xml += `        <score2>${g.score2}</score2>\n`;
				xml += `        <winner>${g.winner}</winner>\n`;
				xml += `        <startedAt>${g.startedAt?.toISOString() || ''}</startedAt>\n`;
				xml += `        <endedAt>${g.endedAt?.toISOString() || ''}</endedAt>\n`;
				xml += '      </game>\n';
			}
			xml += '    </pongGames>\n';
			xml += '    <breatheGames>\n';
			for (const g of breatheGames) {
				xml += '      <game>\n';
				xml += `        <id>${g.id.toString()}</id>\n`;
				xml += `        <startedAt>${g.startedAt?.toISOString() || ''}</startedAt>\n`;
				xml += `        <endedAt>${g.endedAt?.toISOString() || ''}</endedAt>\n`;
				xml += '      </game>\n';
			}
			xml += '    </breatheGames>\n';
			xml += '  </gameHistory>\n';
			
			xml += '  <friends>\n';
			for (const f of friends) {
				xml += '    <friend>\n';
				xml += `      <userId>${f.userId}</userId>\n`;
				xml += `      <status>${f.status}</status>\n`;
				xml += `      <since>${f.since.toISOString()}</since>\n`;
				xml += '    </friend>\n';
			}
			xml += '  </friends>\n';

			// chat history
			xml += '  <chatHistory>\n';
			xml += '    <messagesSent>\n';
			for (const m of user.sentMessages) {
				xml += '      <message>\n';
				xml += `        <id>${m.id}</id>\n`;
				xml += `        <content>${escapeXml(m.content)}</content>\n`;
				xml += `        <receiverId>${m.receiverId.toString()}</receiverId>\n`;
				xml += `        <createdAt>${m.createdAt.toISOString()}</createdAt>\n`;
				xml += `        <isRead>${m.isRead}</isRead>\n`;
				xml += '      </message>\n';
			}
			xml += '    </messagesSent>\n';
			xml += '    <messagesReceived>\n';
			for (const m of user.receivedMessages) {
				xml += '      <message>\n';
				xml += `        <id>${m.id}</id>\n`;
				xml += `        <content>${escapeXml(m.content)}</content>\n`;
				xml += `        <senderId>${m.senderId.toString()}</senderId>\n`;
				xml += `        <createdAt>${m.createdAt.toISOString()}</createdAt>\n`;
				xml += `        <isRead>${m.isRead}</isRead>\n`;
				xml += '      </message>\n';
			}
			xml += '    </messagesReceived>\n';
			xml += '  </chatHistory>\n';
			
			xml += '</userData>';

			reply.header('Content-Type', 'application/xml');
			reply.header('Content-Disposition', `attachment; filename="user_data_${userId}.xml"`);

			return xml;
		} catch (error) {
			request.log.error({error}, 'Failed to export XML');
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
