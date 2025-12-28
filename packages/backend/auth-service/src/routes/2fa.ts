import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {generateTOTPSecret, verifyTOTP, generateQRCode} from '../services/totp';
import {verifyAccessToken, generateTokens} from '../services/jwt';
import type {I2FAVerifyRequest} from '@speak-up/shared';

interface AuthenticatedRequest extends FastifyRequest {
	user?: {
		userId:	string;
		role:	string;
	};
}

export async function	twoFactorRoutes(fastify: FastifyInstance) {

	// auth middleware
	fastify.addHook('preHandler', async (request: AuthenticatedRequest, reply: FastifyReply) => {
		const authHeader = request.headers.authorization;
		
		if (!authHeader?.startsWith('Bearer ')) {
			return reply.status(401).send({
				statusCode:	401,
				error:		'Unauthorized',
				message:	'Missing or invalid authorization header',
			});
		}

		try {
			const token		= authHeader.substring(7);
			const payload	= await verifyAccessToken(token);
			request.user	= payload;
		} catch (error) {
			return reply.status(401).send({
				statusCode:	401,
				error:		'Unauthorized',
				message:	'Invalid or expired token',
			});
		}
	});

	// init 2fa setup
	fastify.post('/setup', async (request: AuthenticatedRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		try {
			// check if already enabled
			const user = await prisma.user.findUnique({
				where:	{id: BigInt(userId)},
				select: {
					twofaEnabled:	true,
					twofaSecret:	true,
					email:			true,
				},
			});

			if (!user) {
				return reply.status(404).send({
					statusCode:	404,
					error:		'Not Found',
					message:	'User not found',
				});
			}

			if (user.twofaEnabled) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'2FA is already enabled',
				});
			}

			// gen new TOTP secret
			const {secret, otpauthUrl} = generateTOTPSecret(user.email);

			// store secret temp
			await prisma.user.update({
				where:	{id: BigInt(userId)},
				data:	{twofaSecret: secret},
			});

			// generate QRcode
			const qrCode = await generateQRCode(otpauthUrl);

			return {
				secret,
				qrCode,
				message: 'Scan the QR code with your authenticator app, then verify with a code',
			};

		} catch (error) {
			request.log.error({error}, '2FA setup failed');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to setup 2FA',
			});
		}
	});

	// verify 2fa tok during auth
	fastify.post<{Body: I2FAVerifyRequest}>(
		'/verify',
		async (request, reply) => {
			const userId = (request as AuthenticatedRequest).user!.userId;
			const {code} = request.body;

			if (!code) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Verification code is required',
				});
			}

			try {
				// fetch 2FA secret for user
				const user = await prisma.user.findUnique({
					where: {id: BigInt(userId)},
					select: {
						twofaSecret:	true,
						twofaEnabled:	true,
						role:	true,
					},
				});

				if (!user) {
					return reply.status(404).send({
						statusCode:	404,
						error:		'Not Found',
						message:	'User not found',
					});
				}

				if (!user.twofaSecret) {
					return reply.status(400).send({
						statusCode:	400,
						error:		'Bad Request',
						message:	'2FA is not configured. Please run setup first.',
					});
				}

				// verify the TOTP code
				const isValid = verifyTOTP(user.twofaSecret, code);

				if (!isValid) {
					return reply.status(401).send({
						statusCode:	401,
						error:		'Unauthorized',
						message:	'Invalid verification code',
					});
				}

				// first-time setup -> enable 2FA
				if (!user.twofaEnabled) {
					await prisma.user.update({
						where:	{id: BigInt(userId)},
						data:	{twofaEnabled: true},
					});
					request.log.info({userId}, '2FA enabled for user');
				}

				// generate new tokens
				const tokens = await generateTokens({
					userId,
					role:			user.role,
					requires2FA:	false, // 2FA verified, full access granted
				});

				return {
					success:		true,
					message:		'2FA verification successful',
					accessToken:	tokens.accessToken,
					refreshToken:	tokens.refreshToken,
				};

			} catch (error) {
				request.log.error({error}, '2FA verification failed');
				return reply.status(500).send({
					statusCode:	500,
					error:		'Internal Server Error',
					message:	'Failed to verify 2FA code',
				});
			}
		}
	);

	// disable 2fa
	fastify.post<{Body: {code: string}}>(
		'/disable',
		async (request, reply) => {
			const userId = (request as AuthenticatedRequest).user!.userId;
			const {code} = request.body;

			if (!code) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Current 2FA code is required to disable',
				});
			}

			try {
				const user = await prisma.user.findUnique({
					where: {id: BigInt(userId)},
					select: {
						twofaSecret:	true,
						twofaEnabled:	true,
					},
				});

				if (!user) {
					return reply.status(404).send({
						statusCode:	404,
						error:		'Not Found',
						message:	'User not found',
					});
				}

				if (!user.twofaEnabled) {
					return reply.status(400).send({
						statusCode:	400,
						error:		'Bad Request',
						message:	'2FA is not enabled',
					});
				}

				// verify code
				const isValid = verifyTOTP(user.twofaSecret!, code);

				if (!isValid) {
					return reply.status(401).send({
						statusCode:	401,
						error:		'Unauthorized',
						message:	'Invalid verification code',
					});
				}

				// disable 2FA
				await prisma.user.update({
					where: {id: BigInt(userId)},
					data: {
						twofaEnabled:	false,
						twofaSecret:	null,
					},
				});

				request.log.info({userId}, '2FA disabled for user');

				return {
					success:	true,
					message:	'2FA has been disabled',
				};

			} catch (error) {
				request.log.error({error}, '2FA disable failed');
				return reply.status(500).send({
					statusCode:	500,
					error:		'Internal Server Error',
					message:	'Failed to disable 2FA',
				});
			}
		}
	);
}
