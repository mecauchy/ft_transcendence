import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db';
import { authMiddleware } from '../middleware/auth';
import { config } from '../config';
import type { IUserProfile } from '@speak-up/shared';
import { UserRole } from '@speak-up/shared';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function profileRoutes(fastify: FastifyInstance) {
	// apply auth middleware to all routes
	fastify.addHook('preHandler', authMiddleware);

	// get curr user data
	fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			const result = await query(
				`SELECT u.user_id, u.user_username, u.user_email, u.user_role, 
						u.user_twofa_enabled, u.user_creation_date,
						s.settings_avatar, s.settings_locale, s.settings_colour
				FROM users u
				LEFT JOIN settings s ON u.user_id = s.settings_userid
				WHERE u.user_id = $1`,
				[userId]
			);

			if (result.rows.length === 0) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'User not found',
				});
			}

			const user = result.rows[0];

			// fetching user stats
			const statsResult = await query(
				`SELECT COUNT(*) as sessions_completed,
					COALESCE(AVG((final_metrics->>'trust')::numeric), 0) as avg_trust
				FROM sessions
				WHERE patient_id = $1 AND status = 'COMPLETED'`,
				[userId]
			);
			const stats = statsResult.rows[0];

			const profile: IUserProfile = {
				id: user.user_id.toString(),
				alias: user.user_username,
				username: user.user_username,
				email: user.user_email,
				avatarUrl: user.settings_avatar || '/assets/default-avatar.png',
				role: user.user_role as UserRole,
				preferences: {
					language: (user.settings_locale || 'en') as 'en' | 'fr',
					theme: (user.settings_colour || 'light') as 'light' | 'dark',
					accessibility: {
						highContrast: false,
						textToSpeech: false,
						fontSize: 'medium',
					},
				},
				stats: {
					sessionsCompleted: parseInt(stats.sessions_completed) || 0,
					averageTrustScore: parseFloat(stats.avg_trust) || 0,
				},
			};

			return profile;
		} catch (error) {
			request.log.error({ error }, 'Failed to fetch user profile');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to fetch profile',
			});
		}
	});

	// updaute curr user profile
	fastify.put<{
		Body: {
			username?: string;
			email?: string;
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
		const userId = request.user!.userId;
		const { username, email, preferences } = request.body;

		try {
			// update usertable if email or username given
			if (username || email) {
				const updates: string[] = [];
				const values: unknown[] = [];
				let paramIndex = 1;

				if (username) {
					updates.push(`user_username = $${paramIndex++}`);
					values.push(username);
				}
				if (email) {
					updates.push(`user_email = $${paramIndex++}`);
					values.push(email);
				}

				updates.push(`user_modification_date = NOW()`);
				values.push(userId);

				await query(
					`UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
					values
				);
			}

			// update settings if preferences given
			if (preferences) {
				const settingsUpdates: string[] = [];
				const settingsValues: unknown[] = [];
				let paramIndex = 1;

				if (preferences.language) {
					settingsUpdates.push(`settings_locale = $${paramIndex++}`);
					settingsValues.push(preferences.language);
				}
				if (preferences.theme) {
					settingsUpdates.push(`settings_colour = $${paramIndex++}`);
					settingsValues.push(preferences.theme);
				}

				if (settingsUpdates.length > 0) {
					settingsValues.push(userId);
					await query(
						`UPDATE settings SET ${settingsUpdates.join(', ')} WHERE settings_userid = $${paramIndex}`,
						settingsValues
					);
				}
			}

			return { success: true, message: 'Profile updated successfully' };
		} catch (error) {
			request.log.error({ error }, 'Failed to update profile');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to update profile',
			});
		}
	});

	// file upload -> img
	fastify.put('/me/avatar', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			const file = await request.file();

			if (!file) {
				return reply.status(400).send({
					statusCode: 400,
					error: 'Bad Request',
					message: 'No file uploaded',
				});
			}

			// validate mimetype
			if (!config.upload.allowedMimeTypes.includes(file.mimetype)) {
				return reply.status(400).send({
					statusCode: 400,
					error: 'Bad Request',
					message: `Invalid file type. Allowed: ${config.upload.allowedMimeTypes.join(', ')}`,
				});
			}

			// gen unique filename
			const fileExt = path.extname(file.filename) || '.png';
			const newFilename = `${userId}_${uuidv4()}${fileExt}`;
			const filePath = path.join(config.upload.avatarPath, newFilename);
			// directory sanity
			await fs.mkdir(config.upload.avatarPath, { recursive: true });
			// save file
			const buffer = await file.toBuffer();
			await fs.writeFile(filePath, buffer);
			// update DB
			const avatarUrl = `/uploads/avatars/${newFilename}`;
			await query(
				`UPDATE settings SET settings_avatar = $1 WHERE settings_userid = $2`,
				[avatarUrl, userId]
			);

			// cleanup oldavatar
			const oldAvatar = await query(
				`SELECT settings_avatar FROM settings WHERE settings_userid = $1`,
				[userId]
			);
			if (oldAvatar.rows[0]?.settings_avatar && oldAvatar.rows[0].settings_avatar !== avatarUrl) {
				const oldPath = path.join('/app', oldAvatar.rows[0].settings_avatar);
				await fs.unlink(oldPath).catch(() => {}); // ignores error
			}

			return { success: true, url: avatarUrl };
		} catch (error) {
			request.log.error({ error }, 'Failed to upload avatar');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to upload avatar',
			});
		}
	});

	// get someone's profile
	fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
		const { id } = request.params;

		try {
			const result = await query(
				`SELECT u.user_id, u.user_username, u.user_role,
					s.settings_avatar
				FROM users u
				LEFT JOIN settings s ON u.user_id = s.settings_userid
				WHERE u.user_id = $1`,
				[id]
			);

			if (result.rows.length === 0) {
				return reply.status(404).send({
					statusCode: 404,
					error: 'Not Found',
					message: 'User not found',
				});
			}

			const user = result.rows[0];

			return {
				id: user.user_id.toString(),
				username: user.user_username,
				avatarUrl: user.settings_avatar || '/assets/default-avatar.png',
				role: user.user_role,
			};
		} catch (error) {
			request.log.error({ error }, 'Failed to fetch user profile');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to fetch profile',
			});
		}
	});
}
