import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';

export async function settingsRoutes(fastify: FastifyInstance) {
	// apply middleware
	fastify.addHook('preHandler', authMiddleware);

	// get user settings
	fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);

		try {
			const settings = await prisma.settings.findUnique({
				where: {userId},
			});

			if (!settings) {
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

			return {
				avatar: settings.avatar,
				theme: settings.colour || 'light',
				language: settings.locale || 'en',
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
			request.log.error({error}, 'Failed to fetch settings');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch settings',
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
		const userId = BigInt(request.user!.userId);
		const {theme, language} = request.body;

		try {
			await prisma.settings.upsert({
				where: {userId},
				update: {
					...(theme && {colour: theme}),
					...(language && {locale: language}),
				},
				create: {
					userId,
					colour: theme || 'light',
					locale: language || 'en',
				},
			});

			return {success: true, message:	'Settings updated'};
		} catch (error) {
			request.log.error({error}, 'Failed to update settings');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to update settings',
			});
		}
	});
}
