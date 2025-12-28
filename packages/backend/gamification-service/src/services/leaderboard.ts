import {prisma} from '../db';
import Redis from 'ioredis';
import {config} from '../config';

const redis = new Redis({
	host: config.redis.host,
	port: config.redis.port,
});

export interface LeaderboardEntry {
	rank: number;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	level: number;
	totalXP: number;
	score: number;
}

export type LeaderboardType = 'XP' | 'LEVEL' | 'SESSIONS' | 'ACHIEVEMENTS' | 'SCENARIO';

// global lb
export async function getGlobalLeaderboard(
	type: LeaderboardType = 'XP',
	limit: number = 100,
	offset: number = 0
): Promise<LeaderboardEntry[]> {
	const cacheKey = `leaderboard:global:${type}:${limit}:${offset}`;
	const cached = await redis.get(cacheKey);

	if (cached) {
		return JSON.parse(cached);
	}

	let users;

	switch (type) {
		case 'XP':
			users = await prisma.user.findMany({
				where: {isActive: true},
				orderBy: {totalXp: 'desc'},
				take: limit,
				skip: offset,
				include: {
					settings: {select: {avatar: true}},
				},
			});
			break;

		case 'LEVEL':
			users = await prisma.user.findMany({
				where: {isActive: true},
				orderBy: [{currentLevel: 'desc'}, {totalXp: 'desc'}],
				take: limit,
				skip: offset,
				include: {
					settings: {select: {avatar: true}},
				},
			});
			break;

		case 'SESSIONS':
			users = await prisma.user.findMany({
				where: {isActive: true},
				include: {
					settings: {select: {avatar: true}},
					patientSessions: {
						where: {status: 'COMPLETED'},
						select: {id: true},
					},
				},
			});
			// sort by session count
			users.sort((a, b) => 
				(b.patientSessions?.length || 0) - (a.patientSessions?.length || 0)
			);
			users = users.slice(offset, offset + limit);
			break;

		case 'ACHIEVEMENTS':
			users = await prisma.user.findMany({
				where: {isActive: true},
				include: {
					settings: {select: {avatar: true}},
					achievements: {select: {id: true}},
				},
			});
			// sort by achievement count
			users.sort((a, b) => 
				(b.achievements?.length || 0) - (a.achievements?.length || 0)
			);
			users = users.slice(offset, offset + limit);
			break;

		default:
			users = await prisma.user.findMany({
				where: {isActive: true},
				orderBy: {totalXp: 'desc'},
				take: limit,
				skip: offset,
				include: {
					settings: {select: {avatar: true}},
				},
			});
	}

	const entries: LeaderboardEntry[] = users.map((user, index) => {
		let score = user.totalXp || 0;
		if (type === 'LEVEL') score = user.currentLevel || 1;
		if (type === 'SESSIONS') score = (user as {patientSessions?: unknown[]}).patientSessions?.length || 0;
		if (type === 'ACHIEVEMENTS') score = (user as {achievements?: unknown[]}).achievements?.length || 0;

		return {
			rank: offset + index + 1,
			userId: user.id.toString(),
			displayName: user.username,
			avatarUrl: (user as {settings?: {avatar?: string | null}}).settings?.avatar || null,
			level: user.currentLevel || 1,
			totalXP: user.totalXp || 0,
			score,
		};
	});

	// cache configured TTL
	await redis.setex(cacheKey, config.gamification.leaderboardCacheTTL, JSON.stringify(entries));

	return entries;
}

// scenario specific lb
export async function getScenarioLeaderboard(
	scenarioId: string,
	limit: number = 100,
	offset: number = 0
): Promise<LeaderboardEntry[]> {
	const cacheKey = `leaderboard:scenario:${scenarioId}:${limit}:${offset}`;
	const cached = await redis.get(cacheKey);

	if (cached) {
		return JSON.parse(cached);
	}

	// get completed sessions for scenario with user data
	const sessions = await prisma.session.findMany({
		where: {
			scenarioId: BigInt(scenarioId),
			status: 'COMPLETED',
			patientId: {not: null},
		},
		include: {
			patient: {
				include: {
					settings: {select: {avatar: true}},
				},
			},
		},
	});

	// group by user, get best score
	const userScores = new Map<string, {user: typeof sessions[0]['patient']; bestScore: number}>();

	for (const session of sessions) {
		if (!session.patient) continue;
		const userId = session.patientId!.toString();
		const metrics = session.finalMetrics as Record<string, number> | null;
		const trust = (metrics?.trust || 0) * 100;

		const existing = userScores.get(userId);
		if (!existing || trust > existing.bestScore) {
			userScores.set(userId, {user: session.patient, bestScore: trust});
		}
	}

	// sort and paginate
	const sorted = Array.from(userScores.entries())
		.sort((a, b) => b[1].bestScore - a[1].bestScore)
		.slice(offset, offset + limit);

	const entries: LeaderboardEntry[] = sorted.map(([userId, data], index) => ({
		rank: offset + index + 1,
		userId,
		displayName: data.user!.username,
		avatarUrl: data.user!.settings?.avatar || null,
		level: data.user!.currentLevel || 1,
		totalXP: data.user!.totalXp || 0,
		score: Math.round(data.bestScore),
	}));

	await redis.setex(cacheKey, config.gamification.leaderboardCacheTTL, JSON.stringify(entries));

	return entries;
}

// get userrank on lb
export async function getUserRank(userId: string, type: LeaderboardType = 'XP'): Promise<number> {
	const cacheKey = `user:${userId}:rank:${type}`;
	const cached = await redis.get(cacheKey);

	if (cached) {
		return parseInt(cached);
	}

	const user = await prisma.user.findUnique({
		where: {id: BigInt(userId)},
	});

	if (!user) return 0;

	let rank: number;

	switch (type) {
		case 'XP':
			rank = await prisma.user.count({
				where: {
					isActive: true,
					totalXp: {gt: user.totalXp || 0},
				},
			}) + 1;
			break;
		case 'LEVEL':
			rank = await prisma.user.count({
				where: {
					isActive: true,
					currentLevel: {gt: user.currentLevel || 0},
				},
			}) + 1;
			break;
		default:
			rank = await prisma.user.count({
				where: {
					isActive: true,
					totalXp: {gt: user.totalXp || 0},
				},
			}) + 1;
	}

	await redis.setex(cacheKey, 60, rank.toString()); // 1m cache

	return rank;
}

// get friends leaderboard
export async function getFriendsLeaderboard(
	userId: string,
	limit: number = 50
): Promise<LeaderboardEntry[]> {
	const userIdBigInt = BigInt(userId);

	// get friend IDs
	const friendships = await prisma.friend.findMany({
		where: {
			OR: [
				{initiatorId: userIdBigInt},
				{receiverId: userIdBigInt},
			],
			status: 'ACCEPTED',
		},
	});

	const friendIds = friendships.map((f) => 
		f.initiatorId === userIdBigInt ? f.receiverId : f.initiatorId
	);

	// add self to list
	friendIds.push(userIdBigInt);

	// get users
	const users = await prisma.user.findMany({
		where: {
			id: {in: friendIds},
			isActive: true,
		},
		orderBy: {totalXp: 'desc'},
		take: limit,
		include: {
			settings: {select: {avatar: true}},
		},
	});

	return users.map((user, index) => ({
		rank: index + 1,
		userId: user.id.toString(),
		displayName: user.username,
		avatarUrl: user.settings?.avatar || null,
		level: user.currentLevel || 1,
		totalXP: user.totalXp || 0,
		score: user.totalXp || 0,
	}));
}

// invalidate lb cache
export async function invalidateLeaderboardCaches(): Promise<void> {
	const keys = await redis.keys('leaderboard:*');
	if (keys.length > 0) {
		await redis.del(...keys);
	}
}
