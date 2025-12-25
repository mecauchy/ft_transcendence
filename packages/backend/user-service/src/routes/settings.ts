import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db';
import { authMiddleware } from '../middleware/auth';

export async function settingsRoutes(fastify: FastifyInstance) {
	// apply middleware
	fastify.addHook('preHandler', authMiddleware);

	// get user settings
	fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			const result = await query(
				`SELECT settings_avatar, settings_colour, settings_locale
				FROM settings WHERE settings_userid = $1`,
				[userId]
			);

			if (result.rows.length === 0) {
				// if none found return default config
				return {
					avatar: null,
					theme: 'light',
					language: 'en',
					accessibility: {
						highContrast: false,
						textToSpeech: false,
						fontSize: 'medium',
					},
					notifications: {
						email: true,
						push: true,
						friendRequests: true,
						sessionInvites: true,
					},
				};
			}

			const settings = result.rows[0];

			return {
				avatar: settings.settings_avatar,
				theme: settings.settings_colour || 'light',
				language: settings.settings_locale || 'en',
				accessibility: {
					highContrast: false,
					textToSpeech: false,
					fontSize: 'medium',
				},
				notifications: {
					email: true,
					push: true,
					friendRequests: true,
					sessionInvites: true,
				},
			};
		} catch (error) {
			request.log.error({ error }, 'Failed to fetch settings');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to fetch settings',
			});
		}
	});

	// update user settings
	fastify.put<{
		Body: {
			theme?: 'light' | 'dark';
			language?: 'en' | 'fr';
			accessibility?: {
				highContrast?: boolean;
				textToSpeech?: boolean;
				fontSize?: 'small' | 'medium' | 'large';
			};
			notifications?: {
				email?: boolean;
				push?: boolean;
				friendRequests?: boolean;
				sessionInvites?: boolean;
			};
		};
	}>('/', async (request, reply) => {
		const userId = request.user!.userId;
		const { theme, language } = request.body;

		try {
			const updates: string[] = [];
			const values: unknown[] = [];
			let paramIndex = 1;

			if (theme) {
				updates.push(`settings_colour = $${paramIndex++}`);
				values.push(theme);
			}

			if (language) {
				updates.push(`settings_locale = $${paramIndex++}`);
				values.push(language);
			}

			if (updates.length > 0) {
				values.push(userId);
				
				// Upsert settings
				await query(
					`INSERT INTO settings (settings_userid, settings_colour, settings_locale)
					VALUES ($${paramIndex}, $1, $2)
					ON CONFLICT (settings_userid) 
					DO UPDATE SET ${updates.join(', ')}`,
					[theme || 'light', language || 'en', userId]
				);
			}

			return { success: true, message: 'Settings updated' };
		} catch (error) {
			request.log.error({ error }, 'Failed to update settings');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to update settings',
			});
		}
	});
}
