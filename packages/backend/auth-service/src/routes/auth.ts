import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {config} from '../config';
import {prisma} from '../db';
import {generateTokens, verifyRefreshToken, blacklistToken} from '../services/jwt';
import {fetchOAuthToken, fetch42UserInfo} from '../services/oauth';
import type {IAuthResponse, ILoginRequest, IRefreshTokenRequest} from '@speak-up/shared';
import {UserRole} from '@speak-up/shared';
import * as bcrypt from 'bcryptjs';

interface OAuth42CallbackQuery {
	code:	string;
	state?:	string;
}

interface RegisterRequest {
	username:	string;
	email:		string;
	password:	string;
	dob:		string;
}

interface LoginRequest {
	login:		string;
	password:	string;
}

export async function authRoutes(fastify: FastifyInstance) {

	// username and pw registration
	fastify.post<{Body: RegisterRequest}>(
		'/register',
		async (request, reply) => {
			const {username, email, password, dob} = request.body;

			// validate input
			if (!username || !email || !password || !dob) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Username, email, password, and date of birth are required',
				});
			}

			// validate email format
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Invalid email format',
				});
			}

			// validate password norm
			const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
			if (!passwordRegex.test(password)) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
				});
			}

			try {
				// check if user exists
				const existingUser = await prisma.user.findFirst({
					where: {
						OR: [{email}, {username}],
					},
				});

				if (existingUser) {
					const field = existingUser.email === email ? 'email' : 'username';
					return reply.status(409).send({
						statusCode:	409,
						error:		'Conflict',
						message:	`User with this ${field} already exists`,
					});
				}

				// hash password
				const hashedPassword = await bcrypt.hash(password, 12);

				// create user
				const user = await prisma.user.create({
					data: {
						username,
						email,
						password:	hashedPassword,
						dob:		new Date(dob),
						role:		'PATIENT',
						settings: {
							create: {
								locale: 'fr',
							},
						},
					},
				});

				request.log.info({userId: user.id, email}, 'New user registered');

				return reply.status(201).send({
					userId:		user.id.toString(),
					message:	'User registered successfully',
				});
			} catch (error) {
				request.log.error({error}, 'Registration failed');
				return reply.status(500).send({
					statusCode:	500,
					error:		'Internal Server Error',
					message:	'Registration failed',
				});
			}
		}
	);

	// login form handling
	fastify.post<{Body: LoginRequest}>(
		'/login',
		async (request, reply) => {
			const {login, password} = request.body;

			if (!login || !password) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'login and password are required',
				});
			}

			try {
				// find user by email or username
				const isEmail = login.includes('@');
				const user = await prisma.user.findUnique({
					where: isEmail ? {email: login} : {username: login},
				});

				if (!user || !user.password) {
					return reply.status(401).send({
						statusCode:	401,
						error:		'Unauthorized',
						message:	'Invalid login or password',
					});
				}

				// verify hashedpassword
				const isValidPassword = await bcrypt.compare(password, user.password);

				if (!isValidPassword) {
					return reply.status(401).send({
						statusCode:	401,
						error:		'Unauthorized',
						message:	'Invalid login or password',
					});
				}

				// check if 2FA is enabled
				if (user.twofaEnabled) {
					// return partial to frontend -> prompts for 2FA code
					return reply.send({
						requires2FA:	true,
						userId:			user.id.toString(),
						message:		'2FA verification required',
					});
				}

				// token generation
				const tokens = await generateTokens({
					userId:	user.id.toString(),
					role:	user.role,
				});

				// save refresh token
				await prisma.userKey.upsert({
					where: {userId: user.id},
					update: {
						token:		tokens.refreshToken,
						status:		'ACTIVE',
						expiresAt:	new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
					},
					create: {
						userId:		user.id,
						token:		tokens.refreshToken,
						type:		'REFRESH',
						status:		'ACTIVE',
						expiresAt:	new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					},
				});

				request.log.info({userId: user.id}, 'User logged in');

				return reply.send({
					accessToken:	tokens.accessToken,
					refreshToken:	tokens.refreshToken,
					user: {
						userId:		user.id.toString(),
						username:	user.username,
						email:		user.email,
						role:		user.role,
					},
				});
			} catch (error) {
				request.log.error({error}, 'Login failed');
				return reply.status(500).send({
					statusCode:	500,
					error:		'Internal Server Error',
					message:	'Login failed',
				});
			}
		}
	);

	// OAUTH auth (42api)
	fastify.get('/login/42', async (request: FastifyRequest, reply: FastifyReply) => {
		const authUrl = new URL(config.oauth.authorizationUrl);
		authUrl.searchParams.set('client_id', config.oauth.clientId);
		authUrl.searchParams.set('redirect_uri', config.oauth.redirectUri);
		authUrl.searchParams.set('response_type', 'code');
		authUrl.searchParams.set('scope', 'public');

		// generate CSRF token
		const state = crypto.randomUUID();
		authUrl.searchParams.set('state', state);
		reply.header('Set-Cookie', `oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/`);
		
		return reply.redirect(authUrl.toString());
	});

	// GET /callback/42
	fastify.get<{Querystring: OAuth42CallbackQuery}>(
		'/callback/42',
		async (request, reply) => {
			const {code, state} = request.query;

			if (!code) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Authorization code is required',
					});
			}

			try {
				// exchange code for tokens
				const oauthTokens = await fetchOAuthToken(code);
				const userInfo = await fetch42UserInfo(oauthTokens.access_token);

				// find existing user by OAuth provider
				let user = await prisma.user.findFirst({
					where: {
					oauth: {
					provider:		'42',
					providerUserId:	userInfo.id.toString(),
						},
					},
					include: {
						oauth:		true,
						settings:	true,
					},
				});

				let isNewUser = false;

				if (!user) {
					// create new user with OAuth and settings in a transaction
					user = await prisma.user.create({
						data: {
							username:	userInfo.login,
							email:		userInfo.email,
							dob:		new Date('2000-01-01'),
							role:		'PATIENT',
							oauth: {
								create: {
									provider:		'42',
									providerUserId:	userInfo.id.toString(),
										},
								},
							settings: {
								create: {
									avatar:	userInfo.image?.link || null,
									locale:	'en',
								},
							},
						},
						include: {
							oauth:		true,
							settings:	true,
						},
					});
					isNewUser = true;
					request.log.info({userId: user.id, login: userInfo.login}, 'New user created via 42 OAuth');
				} else {
					request.log.info({userId: user.id}, 'Existing user logged in via 42 OAuth');
				}

				const requires2FA = user.twofaEnabled;

				// generate JWT tokens
				const tokens = await generateTokens({
					userId: user.id.toString(),
					role: user.role,
					requires2FA,
				});

				// store refresh token
				await prisma.userKey.upsert({
					where: {userId: user.id},
					create: {
						userId:		user.id,
						token:		tokens.refreshToken,
						type:		'REFRESH',
						status:		'ACTIVE',
						expiresAt:	new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					},
					update: {
						token:		tokens.refreshToken,
						status:		'ACTIVE',
						expiresAt:	new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					},
				});

				const response: IAuthResponse = {
					accessToken:	tokens.accessToken,
					refreshToken:	tokens.refreshToken,
					require2FA:		requires2FA,
					user: {
						id:			user.id.toString(),
						alias:		user.username,
						username:	user.username,
						email:		user.email,
						avatarUrl:	user.settings?.avatar || `https://cdn.intra.42.fr/users/${user.username}.jpg`,
						role:		user.role as UserRole,
						preferences: {
							language:	(user.settings?.locale || 'en') as 'en' | 'fr',
							theme:		'light',
							accessibility: {
								highContrast:	false,
								textToSpeech:	false,
								fontSize:		'medium',
							},
						},
						stats: {
							sessionsCompleted:	0,
							averageTrustScore:	0,
						},
					},
				};

				// return json or redirect
				if (request.headers.accept?.includes('application/json')) {
					return response;
				}
				
				const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
				return reply.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}`);

			} catch (error) {
				request.log.error({error}, 'OAuth callback failed');
				return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to complete OAuth flow',
				});
			}
		}
	);

	// POST /login/42
	fastify.post<{Body: ILoginRequest}>(
		'/login/42',
		async (request, reply) => {
			const {code} = request.body;

			if (!code) {
				return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Authorization code is required',
				});
			}

			request.query = {code} as any;
			return (fastify as any).inject({
				method:		'GET',
				url:		`/api/auth/callback/42?code=${code}`,
				headers:	{...request.headers, accept: 'application/json'},
			});
		}
	);

	// POST /refresh
	fastify.post<{Body: IRefreshTokenRequest}>(
		'/refresh',
		async (request, reply) => {
			const {refreshToken} = request.body;

			if (!refreshToken) {
				return reply.status(400).send({
					statusCode:	400,
					error:		'Bad Request',
					message:	'Refresh token is required',
				});
			}

			try {
				// verify the refresh token
				const payload = await verifyRefreshToken(refreshToken);
				
				// check if token is valid in database
				const tokenRecord = await prisma.userKey.findFirst({
					where: {
					token:		refreshToken,
					status:		'ACTIVE',
					expiresAt:	{gt: new Date()},
					},
				});

				if (!tokenRecord) {
					return reply.status(401).send({
						statusCode:	401,
						error:		'Unauthorized',
						message:	'Invalid or expired refresh token',
					});
				}

				// generate new tokens
				const newTokens = await generateTokens({
					userId:			payload.userId,
					role:			payload.role,
					requires2FA:	false,
				});

				// revoke old token and create new one
				await prisma.userKey.update({
					where:	{id: tokenRecord.id},
					data:	{status: 'REVOKED'},
				});

				await prisma.userKey.create({
					data: {
						userId:		BigInt(payload.userId),
						token:		newTokens.refreshToken,
						type:		'REFRESH',
						status:		'ACTIVE',
						expiresAt:	new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
					},
				});

				return {accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken};

			} catch (error) {
				request.log.error({error}, 'Token refresh failed');
				return reply.status(401).send({
					statusCode:	401,
					error:		'Unauthorized',
					message:	'Invalid refresh token',
				});
			}
		}
	);

	// POST /logout
	fastify.post<{Body: {refreshToken?: string}}>(
		'/logout',
		async (request, reply) => {
			const {refreshToken} = request.body;

			if (refreshToken) {
				await blacklistToken(refreshToken);
				
				// mark token as revoked
				await prisma.userKey.updateMany({
					where:	{token: refreshToken},
					data:	{status: 'REVOKED'},
				});
			}

			return {success: true, message: 'Logged out successfully'};
		}
	);
}
