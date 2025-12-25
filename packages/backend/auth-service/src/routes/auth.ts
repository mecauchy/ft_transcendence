import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';
import { query } from '../db';
import { generateTokens, verifyRefreshToken, blacklistToken } from '../services/jwt';
import { fetchOAuthToken, fetch42UserInfo } from '../services/oauth';
import type { IAuthResponse, ILoginRequest, IRefreshTokenRequest } from '@speak-up/shared';
import { UserRole } from '@speak-up/shared';

interface OAuth42CallbackQuery {
	code: string;
	state?: string;
}

export async function authRoutes(fastify: FastifyInstance) {

	// get routes for 42api
	fastify.get('/login/42', async (request: FastifyRequest, reply: FastifyReply) => {
		const authUrl = new URL(config.oauth.authorizationUrl);
		authUrl.searchParams.set('client_id', config.oauth.clientId);
		authUrl.searchParams.set('redirect_uri', config.oauth.redirectUri);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('scope', 'public');

		// generate csrf token
		const state = crypto.randomUUID();
		authUrl.searchParams.set('state', state);
		// store token in session
		reply.header('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/`);
		
		return reply.redirect(authUrl.toString());
	});

	// exchange oauth token
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
				const oauthTokens = await fetchOAuthToken(code);
				// fetch user info from tokenb
				const userInfo = await fetch42UserInfo(oauthTokens.access_token);

				// find or create in dbA
				let userResult = await query(
					`SELECT u.*, o.oauth_provider_userid 
					FROM users u 
					JOIN oauth o ON u.user_id = o.oauth_userid 
					WHERE o.oauth_provider = '42' AND o.oauth_provider_userid = $1`,
					[userInfo.id.toString()]
				);

				let userId: string;
				let isNewUser = false;

				if (userResult.rows.length === 0) {
					// if no user found, create new user
					const insertUserResult = await query(
						`INSERT INTO users (user_username, user_email, user_dob, user_role)
						VALUES ($1, $2, $3, $4)
						RETURNING user_id`,
						[userInfo.login, userInfo.email, new Date('2000-01-01'), 'PATIENT']
					);
					userId = insertUserResult.rows[0].user_id;
					isNewUser = true;

					// link to OAuth provider
					await query(
						`INSERT INTO oauth (oauth_userid, oauth_provider, oauth_provider_userid)
						VALUES ($1, $2, $3)`,
						[userId, '42', userInfo.id.toString()]
					);

					// default settings
					await query(
						`INSERT INTO settings (settings_userid, settings_avatar, settings_locale)
						VALUES ($1, $2, $3)`,
						[userId, userInfo.image?.link || null, 'en']
					);

					request.log.info({ userId, login: userInfo.login }, 'New user created via 42 OAuth');
				} else {
					userId = userResult.rows[0].user_id;
					request.log.info({ userId }, 'Existing user logged in via 42 OAuth');
				}

				// check 2fa
				const twoFAResult = await query(
					`SELECT user_twofa_enabled FROM users WHERE user_id = $1`,
					[userId]
				);
				const requires2FA = twoFAResult.rows[0]?.user_twofa_enabled || false;

				const profileResult = await query(
					`SELECT u.user_id, u.user_username, u.user_email, u.user_role, u.user_twofa_enabled,
							s.settings_avatar, s.settings_locale
					FROM users u
					LEFT JOIN settings s ON u.user_id = s.settings_userid
					WHERE u.user_id = $1`,
					[userId]
				);
				const profile = profileResult.rows[0];

				// gen JWT tokens
				const tokens = await generateTokens({
					userId: userId.toString(),
					role: profile.user_role,
					requires2FA,
				});

				// store token in database
				await query(
					`INSERT INTO user_keys (key_userid, key_token, key_type, key_status, key_expiry_date)
					VALUES ($1, $2, 'REFRESH', 'ACTIVE', NOW() + INTERVAL '7 days')`,
					[userId, tokens.refreshToken]
				);

				const response: IAuthResponse = {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					require2FA: requires2FA,
					user: {
						id: userId.toString(),
						alias: profile.user_username,
						username: profile.user_username,
						email: profile.user_email,
						avatarUrl: profile.settings_avatar || `https://cdn.intra.42.fr/users/${profile.user_username}.jpg`,
						role: profile.user_role as UserRole,
						preferences: {
							language: (profile.settings_locale || 'en') as 'en' | 'fr',
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

				// redirect to frontend with tokens (or JSON for API calls)
				if (request.headers.accept?.includes('application/json')) {
					return response;
				}
				
				// redirect with token in url
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


	// use token for post
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

			// reuse callback
			request.query = { code } as any;
			return (fastify as any).inject({
				method: 'GET',
				url: `/api/auth/callback/42?code=${code}`,
				headers: { ...request.headers, accept: 'application/json' },
			});
		}
	);


	// refresh access token
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
				// verify tok
				const payload = await verifyRefreshToken(refreshToken);
				const tokenResult = await query(
					`SELECT * FROM user_keys 
					WHERE key_token = $1 AND key_status = 'ACTIVE' AND key_expiry_date > NOW()`,
					[refreshToken]
				);

				if (tokenResult.rows.length === 0) {
					return reply.status(401).send({
						statusCode: 401,
						error: 'Unauthorized',
						message: 'Invalid or expired refresh token',
					});
				}

				// generate new tokens
				const newTokens = await generateTokens({
					userId: payload.userId,
					role: payload.role,
					requires2FA: false,
				});

				// refresh token
				await query(
					`UPDATE user_keys SET key_status = 'REVOKED' WHERE key_token = $1`,
					[refreshToken]
				);

				await query(
					`INSERT INTO user_keys (key_userid, key_token, key_type, key_status, key_expiry_date)
					VALUES ($1, $2, 'REFRESH', 'ACTIVE', NOW() + INTERVAL '7 days')`,
					[payload.userId, newTokens.refreshToken]
				);

				return { accessToken: newTokens.accessToken };

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

	// invalidate refresh token
	fastify.post<{ Body: { refreshToken?: string } }>(
		'/logout',
		async (request, reply) => {
			const { refreshToken } = request.body;

			if (refreshToken) {
				// blacklist the token
				await blacklistToken(refreshToken);
				await query(
					`UPDATE user_keys SET key_status = 'REVOKED' WHERE key_token = $1`,
					[refreshToken]
				);
			}

			return { success: true, message: 'Logged out successfully' };
		}
	);
}
