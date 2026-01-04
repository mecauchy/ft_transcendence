import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import {config} from '../config';
import type {IUserProfile} from '@speak-up/shared';
import {UserRole} from '@speak-up/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import {v4 as uuidv4} from 'uuid';

function isValidBigIntId(id: string): boolean {
	return /^\d+$/.test(id);
}

export async function profileRoutes(fastify: FastifyInstance) {
	// apply auth middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// search user by username
	fastify.get<{Querystring: {username: string}}>('/search', async (request: FastifyRequest<{Querystring: {username: string}}>, reply: FastifyReply) => {
		const {username} = request.query;

		if (!username || typeof username !== 'string') {
			return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'Username query parameter is required',
			});
		}

		try {
			const user = await prisma.user.findUnique({
				where: {username},
				select: {
					id: true,
					username: true,
				},
			});

			if (!user) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'User not found',
				});
			}

			return {
				id: user.id.toString(),
				username: user.username,
			};
		} catch (error) {
			request.log.error({error}, 'Failed to search user');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to search user',
			});
		}
	});

	// get curr user data
	fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const user = await prisma.user.findUnique({
				where: {id: userId},
				select: {
					id: true,
					username: true,
					email: true,
					role: true,
					twofaEnabled: true,
					createdAt: true,
					totalXp: true,
					currentLevel: true,
					stressLevel: true,
					confidenceLevel: true,
					displayName: true,
					avatarUrl: true,
					lastActiveAt: true,
					settings: {
						select: {
							avatar: true,
							locale: true,
							colour: true,
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

			// fetching user stats
			const sessions = await prisma.session.findMany({
				where: {
					patientId: userId,
					status: 'COMPLETED',
				},
				select: {
					finalMetrics: true,
				},
			});

			const sessionsCompleted = sessions.length;
			let avgTrust = 0;
			if (sessionsCompleted > 0) {
				const totalTrust = sessions.reduce((sum, s) => {
					const metrics = s.finalMetrics as {trust?: number} | null;
					return sum + (metrics?.trust || 0);
				}, 0);
				avgTrust = totalTrust / sessionsCompleted;
			}

			const profile = {
				id: user.id.toString(),
				alias: user.username,
				username: user.username,
				email: user.email,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl || user.settings?.avatar || '/assets/default-avatar.png',
				role: user.role as UserRole,
				twofaEnabled: user.twofaEnabled || false,
				totalXp: user.totalXp,
				level: user.currentLevel,
				stressLevel: user.stressLevel,
				confidenceLevel: user.confidenceLevel,
				lastActiveAt: user.lastActiveAt?.toISOString(),
				createdAt: user.createdAt?.toISOString(),
				preferences: {
					language: (user.settings?.locale || 'en') as 'en' | 'fr',
					theme: (user.settings?.colour || 'light') as 'light' | 'dark',
					accessibility: {
						highContrast: false,
						textToSpeech: false,
						fontSize: 'medium',
					},
				},
				stats: {
					sessionsCompleted,
					averageTrustScore: avgTrust,
				},
			};

			return profile;
		} catch (error) {
			request.log.error({error}, 'Failed to fetch user profile');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch profile',
			});
		}
	});

	// get other person profile
	fastify.get<{ Params: {id: string} }>('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
		const {id: idStr} = (request.params as {id: string});
		const id = BigInt(idStr);

		if (!isValidBigIntId(idStr)) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Invalid user id',
			});
		}

		try {
			const user = await prisma.user.findUnique({
				where: {id: id},
				select: {
					id: true,
					username: true,
					email: true,
					role: true,
					createdAt: true,
					totalXp: true,
					currentLevel: true,
					stressLevel: true,
					confidenceLevel: true,
					displayName: true,
					avatarUrl: true,
					lastActiveAt: true,
					settings: {
						select: {
							avatar: true,
							locale: true,
							colour: true,
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

			// fetching user stats
			const sessions = await prisma.session.findMany({
				where: {
					patientId: id,
					status: 'COMPLETED',
				},
				select: {
					finalMetrics: true,
				},
			});

			const sessionsCompleted = sessions.length;
			let avgTrust = 0;
			if (sessionsCompleted > 0) {
				const totalTrust = sessions.reduce((sum, s) => {
					const metrics = s.finalMetrics as {trust?: number} | null;
					return sum + (metrics?.trust || 0);
				}, 0);
				avgTrust = totalTrust / sessionsCompleted;
			}

			const profile: IUserProfile = {
				id: user.id.toString(),
				alias: user.username,
				username: user.username,
				email: user.email,
				displayName: user.displayName,
				avatarUrl: user.avatarUrl || user.settings?.avatar || '/assets/default-avatar.png',
				role: user.role as UserRole,
				totalXp: user.totalXp,
				level: user.currentLevel,
				stressLevel: user.stressLevel,
				confidenceLevel: user.confidenceLevel,
				lastActiveAt: user.lastActiveAt?.toISOString(),
				createdAt: user.createdAt?.toISOString(),
				preferences: {
					language: (user.settings?.locale || 'en') as 'en' | 'fr',
					theme: (user.settings?.colour || 'light') as 'light' | 'dark',
					accessibility: {
						highContrast: false,
						textToSpeech: false,
						fontSize: 'medium',
					},
				},
				stats: {
					sessionsCompleted,
					averageTrustScore: avgTrust,
				},
			};

			return profile;
		} catch (error) {
			request.log.error({error}, 'Failed to fetch user profile');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch profile',
			});
		}
	});

	// update curr user profile
	fastify.put<{
		Body: {
			username?: string;
			email?: string;
			displayName?: string;
			stressLevel?: number;
			confidenceLevel?: number;
			preferences?: {
				language?: 'en' | 'fr';
				theme?: 'light' | 'dark';
				accessibility?: {
					highContrast?: boolean;
					textToSpeech?: boolean;
					fontSize?: 'small' | 'medium' | 'large';
				};
			};
		};
	}>('/me', async (request, reply) => {
		const userId = BigInt(request.user!.userId);
		const {username, email, displayName, stressLevel, confidenceLevel, preferences} = request.body;

		try {
			// update user table if any user field given
			const userUpdateData: Record<string, unknown> = {};
			if (username) userUpdateData.username = username;
			if (email) userUpdateData.email = email;
			if (displayName !== undefined) userUpdateData.displayName = displayName;
			if (stressLevel !== undefined) userUpdateData.stressLevel = Math.max(0, Math.min(100, stressLevel));
			if (confidenceLevel !== undefined) userUpdateData.confidenceLevel = Math.max(0, Math.min(100, confidenceLevel));

			if (Object.keys(userUpdateData).length > 0) {
				userUpdateData.updatedAt = new Date();
				await prisma.user.update({
					where: {id: userId},
					data: userUpdateData,
				});
			}

			// update settings if preferences given
			if (preferences) {
				await prisma.settings.upsert({
					where: {userId},
					update: {
						...(preferences.language && {locale: preferences.language}),
						...(preferences.theme && {colour: preferences.theme}),
					},
					create: {
						userId,
						locale: preferences.language || 'en',
						colour: preferences.theme || 'light',
					},
				});
			}

			return {success: true, message:	'Profile updated successfully'};
		} catch (error) {
			request.log.error({error}, 'Failed to update profile');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to update profile',
			});
		}
	});

	// file upload -> img
	fastify.put('/me/avatar', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const file = await request.file();

			if (!file) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'No file uploaded',
				});
			}

			// validate mimetype
			if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	`Invalid file type. Allowed: ${config.upload.allowedMimeTypes.join(', ')}`,
				});
			}

			// gen unique filename
			const fileExt = path.extname(file.filename) || '.png';
			const newFilename = `${userId}_${uuidv4()}${fileExt}`;
			const filePath = path.join(config.upload.avatarPath, newFilename);

			// directory sanity
			await fs.mkdir(config.upload.avatarPath, {recursive: true});

			// save file
			const buffer = await file.toBuffer();
			await fs.writeFile(filePath, buffer);

			// get old avatar for cleanup
			const existingSettings = await prisma.settings.findUnique({
				where: {userId},
				select: {avatar: true},
			});

			// update DB
			const avatarUrl = `/uploads/avatars/${newFilename}`;
			await prisma.settings.upsert({
				where: {userId},
				update: {avatar: avatarUrl},
				create: {
					userId,
					avatar: avatarUrl,
				},
			});

			// cleanup old avatar
			if (existingSettings?.avatar && existingSettings.avatar !== avatarUrl) {
				const oldPath = path.join('/app', existingSettings.avatar);
				await fs.unlink(oldPath).catch(() => {}); // ignores error
			}

			return {success: true, url: avatarUrl};
		} catch (error) {
			request.log.error({error}, 'Failed to upload avatar');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to upload avatar',
			});
		}
	});
}
