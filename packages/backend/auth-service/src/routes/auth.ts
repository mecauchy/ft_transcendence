import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';
import { prisma } from '../db';
import { generateTokens, verifyRefreshToken, blacklistToken } from '../services/jwt';
import { fetchOAuthToken, fetch42UserInfo } from '../services/oauth';
import type { IAuthResponse, ILoginRequest, IRefreshTokenRequest } from '@speak-up/shared';
import { UserRole } from '@speak-up/shared';

interface OAuth42CallbackQuery {
	code: string;
	state?: string;
}

export async function authRoutes(fastify: FastifyInstance) {

	// GET /login/42 - Redirect to 42 OAuth
	fastify.get('/login/42', async (request: FastifyRequest, reply: FastifyReply) => {
		const authUrl = new URL(config.oauth.authorizationUrl);
		authUrl.searchParams.set('client_id', config.oauth.clientId);
		authUrl.searchParams.set('redirect_uri', config.oauth.redirectUri);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('scope', 'public');

		// Generate CSRF token
		const state = crypto.randomUUID();
		authUrl.searchParams.set('state', state);
		reply.header('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/`);
		
		return reply.redirect(authUrl.toString());
	});

	// GET /callback/42 - OAuth callback handler
	fastify.get<{ Querystring: OAuth42CallbackQuery }>(
		'/callback/42',
		async (request, reply) => {
			const { code, state } = request.query;

			if (!code) {
				return reply.status(400).send({
					statusCode: 400,
					error: 'Bad Request',
					message: 'Authorization code is required',
					});
			}

			try {
				// Exchange code for tokens
				const oauthTokens = await fetchOAuthToken(code);
				const userInfo = await fetch42UserInfo(oauthTokens.access_token);

				// Find existing user by OAuth provider
				let user = await prisma.user.findFirst({
					where: {
					oauth: {
					provider: '42',
					providerUserId: userInfo.id.toString(),
						},
					},
					include: {
						oauth: true,
						settings: true,
					},
				});

				let isNewUser = false;

				if (!user) {
					// Create new user with OAuth and settings in a transaction
					user = await prisma.user.create({
						data: {
						username: userInfo.login,
						email: userInfo.email,
						dob: new Date('2000-01-01'),
						role: 'PATIENT',
						oauth: {
						create: {
						provider: '42',
						providerUserId: userInfo.id.toString(),
								},
							},
							settings: {
								create: {
									avatar: userInfo.image?.link || null,
									locale: 'en',
								},
							},
						},
						include: {
							oauth: true,
							settings: true,
						},
					});
					isNewUser = true;
					request.log.info({ userId: user.id, login: userInfo.login }, 'New user created via 42 OAuth');
				} else {
					request.log.info({ userId: user.id }, 'Existing user logged in via 42 OAuth');
				}

				const requires2FA = user.twofaEnabled;

				// Generate JWT tokens
				const tokens = await generateTokens({
					userId: user.id.toString(),
					role: user.role,
					requires2FA,
				});

				// Store refresh token - delete old one first if exists
				await prisma.userKey.upsert({
					where: { userId: user.id },
					create: {
					userId: user.id,
					token: tokens.refreshToken,
					type: 'REFRESH',
					status: 'ACTIVE',
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
					},
					update: {
						token: tokens.refreshToken,
						status: 'ACTIVE',
						expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					},
				});

				const response: IAuthResponse = {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					require2FA: requires2FA,
					user: {
						id: user.id.toString(),
						alias: user.username,
						username: user.username,
						email: user.email,
						avatarUrl: user.settings?.avatar || `https://cdn.intra.42.fr/users/${user.username}.jpg`,
						role: user.role as UserRole,
						preferences: {
							language: (user.settings?.locale || 'en') as 'en' | 'fr',
							theme: 'light',
							accessibility: {
								highContrast: false,
								textToSpeech: false,
								fontSize: 'medium',
							},
						},
						stats: {
							sessionsCompleted: 0,
							averageTrustScore: 0,
						},
					},
				};

				// Return JSON or redirect based on Accept header
				if (request.headers.accept?.includes('application/json')) {
					return response;
				}
				
				const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
				return reply.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}`);

			} catch (error) {
				request.log.error({ error }, 'OAuth callback failed');
				return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to complete OAuth flow',
				});
			}
		}
	);

	// POST /login/42 - Alternative login endpoint
	fastify.post<{ Body: ILoginRequest }>(
		'/login/42',
		async (request, reply) => {
			const { code } = request.body;

			if (!code) {
				return reply.status(400).send({
				statusCode: 400,
				error: 'Bad Request',
				message: 'Authorization code is required',
				});
			}

			// Reuse callback logic
			request.query = { code } as any;
			return (fastify as any).inject({
				method: 'GET',
				url: `/api/auth/callback/42?code=${code}`,
				headers: { ...request.headers, accept: 'application/json' },
			});
		}
	);

	// POST /refresh - Refresh access token
	fastify.post<{ Body: IRefreshTokenRequest }>(
		'/refresh',
		async (request, reply) => {
			const { refreshToken } = request.body;

			if (!refreshToken) {
				return reply.status(400).send({
					statusCode: 400,
					error: 'Bad Request',
					message: 'Refresh token is required',
				});
			}

			try {
				// Verify the refresh token
				const payload = await verifyRefreshToken(refreshToken);
				
				// Check if token is valid in database
				const tokenRecord = await prisma.userKey.findFirst({
					where: {
					token: refreshToken,
					status: 'ACTIVE',
					expiresAt: { gt: new Date() },
					},
				});

				if (!tokenRecord) {
					return reply.status(401).send({
						statusCode: 401,
						error: 'Unauthorized',
						message: 'Invalid or expired refresh token',
					});
				}

				// Generate new tokens
				const newTokens = await generateTokens({
					userId: payload.userId,
					role: payload.role,
					requires2FA: false,
				});

				// Revoke old token and create new one
				await prisma.userKey.update({
					where: { id: tokenRecord.id },
					data: { status: 'REVOKED' },
				});

				await prisma.userKey.create({
					data: {
						userId: BigInt(payload.userId),
						token: newTokens.refreshToken,
						type: 'REFRESH',
						status: 'ACTIVE',
						expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					},
				});

				return { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken };

			} catch (error) {
				request.log.error({ error }, 'Token refresh failed');
				return reply.status(401).send({
					statusCode: 401,
					error: 'Unauthorized',
					message: 'Invalid refresh token',
				});
			}
		}
	);

	// POST /logout - Invalidate refresh token
	fastify.post<{ Body: { refreshToken?: string } }>(
		'/logout',
		async (request, reply) => {
			const { refreshToken } = request.body;

			if (refreshToken) {
				await blacklistToken(refreshToken);
				
				// Mark token as revoked in database
				await prisma.userKey.updateMany({
					where: { token: refreshToken },
					data: { status: 'REVOKED' },
				});
			}

			return { success: true, message: 'Logged out successfully' };
		}
	);
}
