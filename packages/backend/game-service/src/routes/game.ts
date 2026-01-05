import {FastifyInstance, FastifyRequest, FastifyReply} from 'fastify';
import {prisma} from '../db';
import {authMiddleware} from '../middleware/auth';
import {WebSocketManager} from '../websocket/manager';
import type {IPongGame, IBreatheGame} from '@speak-up/shared';

// shared websocket
let wsManager: WebSocketManager;

export function setWebSocketManager(manager: WebSocketManager) {
	wsManager = manager;
}

function isValidBigIntId(id: string): boolean {
	return /^\d+$/.test(id);
}

function isValidCursor(v: unknown): v is string {
	return typeof v === 'string' && /^\d+$/.test(v);
}

// helper to trigger achievement events
async function triggerAchievementEvent(
	userId: string,
	eventType: string,
	eventData?: Record<string, unknown>
): Promise<void> {
	const internalKey = process.env.INTERNAL_SERVICE_KEY;
	const gamificationServiceUrl = process.env.GAMIFICATION_SERVICE_INTERNAL_URL || 'http://gamification-service:3004';

	if (!internalKey) {
		console.warn('[Achievement] INTERNAL_SERVICE_KEY not set, skipping achievement event:', eventType);
		return;
	}

	try {
		console.log('[Achievement] Triggering event:', eventType, 'for user:', userId, 'with data:', eventData);
		const response = await fetch(`${gamificationServiceUrl}/internal/events`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-internal-key': internalKey,
			},
			body: JSON.stringify({
				userId,
				eventType,
				eventData: eventData || {},
			}),
		});
		const result = await response.json();
		console.log('[Achievement] Event response:', response.status, result);
	} catch (error) {
		// log error without failing
		console.error('[Achievement] Failed to trigger achievement event:', error);
	}
}

// helper to award XP via internal API
async function awardXpInternal(
	userId: string,
	amount: number,
	reason: string
): Promise<void> {
	const internalKey = process.env.INTERNAL_SERVICE_KEY;
	const gamificationServiceUrl = process.env.GAMIFICATION_SERVICE_INTERNAL_URL || 'http://gamification-service:3004';

	if (!internalKey) {
		console.warn('INTERNAL_SERVICE_KEY not set, skipping XP award');
		return;
	}

	try {
		await fetch(`${gamificationServiceUrl}/internal/xp/award`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-internal-key': internalKey,
			},
			body: JSON.stringify({
				userId,
				amount,
				reason,
			}),
		});
	} catch (error) {
		console.error('Failed to award XP:', error);
	}
}

function toJsonPong(row : {
	id:			bigint;
	playerId:	bigint | null;
	mode:		any;
	difficulty:	any;
	score1:		number;
	score2:		number;
	winner:		any;
	startedAt:	Date | null;
	endedAt:	Date | null;
}) {
	return {
		id:			row.id.toString(),
		playerId:	row.playerId ? row.playerId.toString() : null,
		mode:		row.mode,
		difficulty:	row.difficulty,
		score1:		row.score1,
		score2:		row.score2,
		winner:		row.winner,
		startedAt:	row.startedAt ? row.startedAt.toISOString() : null,
		endedAt:	row.endedAt ? row.endedAt.toISOString() : null,
	}
}

function toJsonBreathe(row : {
	id:			bigint;
	playerId:	bigint | null;
	startedAt:	Date | null;
	endedAt:	Date | null;
}) {
	return {
		id:			row.id.toString(),
		playerId:	row.playerId ? row.playerId.toString() : null,
		startedAt:	row.startedAt ? row.startedAt.toISOString() : null,
		endedAt:	row.endedAt ? row.endedAt.toISOString() : null,
	}
}

export async function gameRoutes(fastify: FastifyInstance) {
	// auth middleware
	fastify.addHook('preHandler', authMiddleware);

	// save pong game
	fastify.post<{Body: IPongGame}>('/pong/match', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		// validate request
		// if (request.playerid !== userId) {
		// 	return reply.status(403).send({
		// 		statusCode:	403,
		// 		error:		'Forbidden',
		// 		message:	'Can only send stats for yourself',
		// 	});
		// }

		try {
			// Store game stats in DB
			const {
				mode,
				difficulty,
				score1,
				score2,
				winner,
				timestamp1,
				timestamp2
			} = (request.body as {
				mode: string;
				difficulty: string;
				score1: number;
				score2: number;
				winner: string;
				timestamp1: string | number;
				timestamp2: string | number;
			});

			const gameLog = await prisma.gamePong.create({
				data: {
					playerId: BigInt(userId),
					mode: mode as any,
					difficulty: difficulty as any,
					score1: Number(score1),
					score2: Number(score2),
					winner: winner as any,
					startedAt: new Date(timestamp1),
					endedAt: new Date(timestamp2)
				}
			});

		// Trigger achievement event
		await triggerAchievementEvent(userId, 'PONG_MATCH_SAVED', {
			mode,
			difficulty,
			score1: Number(score1),
			score2: Number(score2),
			winner,
		});

		let xpAmount = 10;
		let xpReason = 'Pong match completed';

		if (winner === 'PLAYER') {
			xpAmount += 15;
			xpReason = 'Pong match won';

			if (difficulty === 'HARD') {
				xpAmount += 10;
				xpReason = 'Pong match won (Hard)';
			} else if (difficulty === 'MEDIUM') {
				xpAmount += 5;
				xpReason = 'Pong match won (Medium)';
			}

			if (Number(score2) === 0) {
				xpAmount += 20;
				xpReason += ' - Flawless!';
			}
		}
		
		await awardXpInternal(userId, xpAmount, xpReason);

		return reply.send({
			success: true,
			gameId: gameLog.id.toString(),
			xpAwarded: xpAmount
		});

	} catch (error) {
		request.log.error({error}, 'Failed to log game');
		return reply.status(500).send({
			statusCode:	500,
			error:		'Internal Server Error',
			message:	'Failed to log game',
		});
	}
	});

	// get pong history for authenticated user
	fastify.get<{Querystring: {cursor?: string; limit?: string};}>('/pong/history', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);
		if (!userId) {
			return reply.status(401).send({
				statusCode:	401,
				error:		'Unauthorized',
				message:	'Authentication required',
			});
		}

		const limitRaw = (request.query as {limit?: string}).limit;
		const limit = Math.min(Math.max(parseInt(limitRaw ?? '20', 10) || 20, 1), 50);

		const cursor = (request.query as {cursor?: string}).cursor;
		if (cursor !== undefined && !isValidCursor(cursor)) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Invalid cursor',
			});
		}

		try {
			const rows = await prisma.gamePong.findMany({
				where: {playerId: userId},
				orderBy: [{endedAt: 'desc'}, {id: 'desc'}],
				take: limit + 1,
				...(cursor ? {
						cursor: {id: BigInt(cursor)},
						skip: 1,
					} : {}
				),
				select: {
					id: true,
					playerId: true,
					mode: true,
					difficulty: true,
					score1: true,
					score2: true,
					winner: true,
					startedAt: true,
					endedAt: true,
				},
			});

			let nextCursor: string | null = null;
			let page = rows;

			if (rows.length > limit) {
				const extra = page.pop();
				if (extra)
					nextCursor = extra.id.toString();
			}

			return reply.send({
				matches: page.map(toJsonPong),
				nextCursor,
			});
		} catch (e) {
			request.log.error({e}, 'Failed to fetch pong history');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch pong history',
			});
		}
	});

	// get pong stats for a user
	fastify.get<{Params: {id: string}, Querystring: {cursor?: string; limit?: string};}>('/pong/history/:id', async (request: FastifyRequest, reply: FastifyReply) => {
		const {id: idStr} = (request.params as {id: string});
		const id = BigInt(idStr);
		if (!isValidBigIntId(idStr)) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Invalid user id',
			});
		}

		const limitRaw = (request.query as {limit?: string}).limit;
		const limit = Math.min(Math.max(parseInt(limitRaw ?? '20', 10) || 20, 1), 50);

		const cursor = (request.query as {cursor?: string}).cursor;
		if (cursor !== undefined && isValidCursor(cursor)) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Invalid cursor',
			});
		}

		try {
			const rows = await prisma.gamePong.findMany({
				where: {playerId: id},
				orderBy: [{endedAt: 'desc'}, {id: 'desc'}],
				take: limit + 1,
				...(cursor ? {
						cursor: {id: BigInt(cursor)},
						skip: 1,
					} : {}
				),
				select: {
					id: true,
					playerId: true,
					mode: true,
					difficulty: true,
					score1: true,
					score2: true,
					winner: true,
					startedAt: true,
					endedAt: true,
				},
			});

			let nextCursor: string | null = null;
			let page = rows;

			if (rows.length > limit) {
				const extra = page.pop();
				if (extra)
					nextCursor = extra.id.toString();
			}

			return reply.send({
				matches: page.map(toJsonPong),
				nextCursor,
			});
		} catch (e) {
			request.log.error({e}, 'Failed to fetch pong history');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch pong history',
			});
		}
	});

	// leaderboard summary for pong
	fastify.get<{Querystring: {limit?: string}}>('/pong/leaderboard', async (request: FastifyRequest, reply: FastifyReply) => {
		try {
			const limitRaw = (request.query as {limit?: string}).limit;
			const limit = Math.min(Math.max(parseInt(limitRaw ?? '50', 10) || 50, 1), 200);

			const games = await prisma.gamePong.findMany({
				where: {playerId: {not: null}},
				select: {
					playerId: true,
					score1: true,
					score2: true,
					winner: true,
					startedAt: true,
					endedAt: true,
				},
			});

			const stats = new Map<string, {
				games: number;
				wins: number;
				pointsFor: number;
				pointsAgainst: number;
				durationSeconds: number;
			}>();

			for (const g of games) {
				const playerId = g.playerId!.toString();
				if (!stats.has(playerId)) {
					stats.set(playerId, {
						games: 0,
						wins: 0,
						pointsFor: 0,
						pointsAgainst: 0,
						durationSeconds: 0,
					});
				}
				const entry = stats.get(playerId)!;
				entry.games += 1;
				if (g.winner === 'PLAYER' || g.winner === 'PLAYER1') {
					entry.wins += 1;
				}
				entry.pointsFor += g.score1 || 0;
				entry.pointsAgainst += g.score2 || 0;
				if (g.startedAt && g.endedAt) {
					entry.durationSeconds += Math.max(0, (g.endedAt.getTime() - g.startedAt.getTime()) / 1000);
				}
			}

			const playerIds = Array.from(stats.keys()).map((id) => BigInt(id));
			const users = await prisma.user.findMany({
				where: {id: {in: playerIds}},
				select: {
					id: true,
					username: true,
					settings: {select: {avatar: true}},
				},
			});

			const userMap = new Map<string, {username: string; avatar: string | null}>();
			for (const u of users) {
				userMap.set(u.id.toString(), {username: u.username, avatar: u.settings?.avatar || null});
			}

			const entries = Array.from(stats.entries()).map(([playerId, s]) => {
				const info = userMap.get(playerId);
				return {
					playerId,
					username: info?.username || 'Unknown',
					avatar: info?.avatar || null,
					games: s.games,
					wins: s.wins,
					losses: Math.max(0, s.games - s.wins),
					pointsFor: s.pointsFor,
					pointsAgainst: s.pointsAgainst,
					durationSeconds: Math.round(s.durationSeconds),
				};
			});

			entries.sort((a, b) => {
				if (b.wins !== a.wins) return b.wins - a.wins;
				if (b.games !== a.games) return b.games - a.games;
				return b.pointsFor - a.pointsFor;
			});

			return reply.send({
				entries: entries.slice(0, limit).map((e, idx) => ({
					rank: idx + 1,
					...e,
				})),
			});
		} catch (error) {
			request.log.error({error}, 'Failed to build pong leaderboard');
			return reply.status(500).send({
				statusCode: 500,
				error: 'Internal Server Error',
				message: 'Failed to fetch leaderboard',
			});
		}
	});

	// send breathe game stats
	fastify.post<{Body: IBreatheGame}>('/breathe', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = request.user!.userId;

		// validate request
		// if (request.playerid !== userId) {
		// 	return reply.status(403).send({
		// 		statusCode:	403,
		// 		error:		'Forbidden',
		// 		message:	'Can only send stats for yourself',
		// 	});
		// }

		try {
			// Store game stats in DB
			const {
				timestamp1,
				timestamp2
			} = (request.body as {
				timestamp1: string | number;
				timestamp2: string | number;
			});

			const gameLog = await prisma.gameBreathe.create({
				data: {
					playerId: BigInt(userId),
					startedAt: new Date(timestamp1),
					endedAt: new Date(timestamp2)
				}
			});

			// trigger achievement event
			const durationSeconds = Math.floor((new Date(timestamp2).getTime() - new Date(timestamp1).getTime()) / 1000);
			await triggerAchievementEvent(userId, 'BREATHE_SESSION_SAVED', {
				durationSeconds,
				duration: durationSeconds,
			});

			// Award XP for breathing session
			let xpAmount = 5; // Base XP
			let xpReason = 'Breathing session completed';
			
			if (durationSeconds >= 300) { // 5+ minutes
				xpAmount = 20;
				xpReason = 'Extended breathing session (5+ min)';
			} else if (durationSeconds >= 180) { // 3+ minutes
				xpAmount = 15;
				xpReason = 'Breathing session (3+ min)';
			} else if (durationSeconds >= 60) { // 1+ minute
				xpAmount = 10;
				xpReason = 'Breathing session (1+ min)';
			}
			
			await awardXpInternal(userId, xpAmount, xpReason);

			return reply.send({
				success: true,
				gameId: gameLog.id.toString(),
				xpAwarded: xpAmount
			});
		} catch (error) {
			request.log.error({error}, 'Failed to log game');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to start session',
			});
		}
	});

	// get breathe stats for curr user
	fastify.get<{Querystring: {cursor?: string; limit?: string};}>('/breathe/history', async (request: FastifyRequest, reply: FastifyReply) => {
		const userId = BigInt(request.user!.userId);
		const limitRaw = (request.query as {limit?: string}).limit;
		const limit = Math.min(Math.max(parseInt(limitRaw ?? '20', 10) || 20, 1), 50);

		const cursor = (request.query as {cursor?: string}).cursor;
		if (cursor !== undefined && isValidCursor(cursor)) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Invalid cursor',
			});
		}

		try {
			const rows = await prisma.gameBreathe.findMany({
				where: {playerId: userId},
				orderBy: [{endedAt: 'desc'}, {id: 'desc'}],
				take: limit + 1,
				...(cursor ? {
						cursor: {id: BigInt(cursor)},
						skip: 1,
					} : {}
				),
				select: {
					id: true,
					playerId: true,
					startedAt: true,
					endedAt: true,
				},
			});

			let nextCursor: string | null = null;
			let page = rows;

			if (rows.length > limit) {
				const extra = page.pop();
				if (extra)
					nextCursor = extra.id.toString();
			}

			return reply.send({
				matches: page.map(toJsonBreathe),
				nextCursor,
			});
		} catch (e) {
			request.log.error({e}, 'Failed to fetch pong history');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch pong history',
			});
		}
	});

	// get breathe stats for a user
	fastify.get<{Params: {id: string}, Querystring: {cursor?: string; limit?: string};}>('/breathe/history/:id', async (request: FastifyRequest, reply: FastifyReply) => {
		const id = BigInt((request.params as {id: string}).id);
		const limitRaw = (request.query as {limit?: string}).limit;
		const limit = Math.min(Math.max(parseInt(limitRaw ?? '20', 10) || 20, 1), 50);

		const cursor = (request.query as {cursor?: string}).cursor;
		if (cursor !== undefined && isValidCursor(cursor)) {
			return reply.status(400).send({
				statusCode:	400,
				error:		'Bad Request',
				message:	'Invalid cursor',
			});
		}

		try {
			const rows = await prisma.gameBreathe.findMany({
				where: {playerId: id},
				orderBy: [{endedAt: 'desc'}, {id: 'desc'}],
				take: limit + 1,
				...(cursor ? {
						cursor: {id: BigInt(cursor)},
						skip: 1,
					} : {}
				),
				select: {
					id: true,
					playerId: true,
					startedAt: true,
					endedAt: true,
				},
			});

			let nextCursor: string | null = null;
			let page = rows;

			if (rows.length > limit) {
				const extra = page.pop();
				if (extra)
					nextCursor = extra.id.toString();
			}

			return reply.send({
				matches: page.map(toJsonBreathe),
				nextCursor,
			});
		} catch (e) {
			request.log.error({e}, 'Failed to fetch pong history');
			return reply.status(500).send({
				statusCode:	500,
				error:		'Internal Server Error',
				message:	'Failed to fetch pong history',
			});
		}
	});

}

