import {prisma} from '../db';
import Redis from 'ioredis';
import {config} from '../config';
import {awardXP} from './xp';

const redis = new Redis({
	host: config.redis.host,
	port: config.redis.port,
});

export interface Achievement {
	id: string;
	code: string;
	name: string;
	description: string;
	iconUrl: string;
	xpReward: number;
	rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
	category: string;
	condition: Record<string, unknown>;
	createdAt: Date;
}

export interface UserAchievement {
	achievementId: string;
	achievement: Achievement;
	unlockedAt: Date;
	progress: number; // 0-100
}

async function notifyAchievementUnlocked(userId: string, achievement: Achievement): Promise<void> {
	const internalKey = process.env.INTERNAL_SERVICE_KEY;
	const userServiceInternal =
		process.env.USER_SERVICE_INTERNAL_URL ||
		// fallback link
		'http://user-service:3002';

	if (!internalKey) {
		// doesnt crash here
		return;
	}

	try {
		await fetch(`${userServiceInternal}/internal/notifications/achievement`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-internal-key': internalKey,
			},
			body: JSON.stringify({
				userId,
				achievement: {
					code: achievement.code,
					name: achievement.name,
					description: achievement.description,
					xpReward: achievement.xpReward,
					rarity: achievement.rarity,
				},
			}),
		});
	} catch {
		// ignore
	}
}

// get all avail achievements
export async function getAllAchievements(): Promise<Achievement[]> {
	const cached = await redis.get('achievements:all');
	if (cached) {
		return JSON.parse(cached);
	}

	const rows = await prisma.achievement.findMany({
		orderBy: [{category: 'asc'}, {rarity: 'asc'}],
	});

	const achievements = rows.map(mapAchievement);

	// redis cache for 10m
	await redis.setex('achievements:all', 600, JSON.stringify(achievements));

	return achievements;
}

// get user's unlocked achievements
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
	const rows = await prisma.userAchievement.findMany({
		where: {userId: BigInt(userId)},
		include: {achievement: true},
		orderBy: {unlockedAt: 'desc'},
	});

	return rows.map((row) => ({
		achievementId: row.achievementId.toString(),
		achievement: mapAchievement(row.achievement),
		unlockedAt: row.unlockedAt,
		progress: 100,
	}));
}

// check and unlock achievement based on event
export async function checkAchievements(
	userId: string,
	eventType: string,
	eventData: Record<string, unknown>
): Promise<Achievement[]> {
	const unlockedAchievements: Achievement[] = [];

	// get all achievements
	const allAchievements = await getAllAchievements();

	// get already unlocked
	const userAchievements = await getUserAchievements(userId);
	const unlockedIds = new Set(userAchievements.map((ua) => ua.achievementId));

	// check each achievement
	for (const achievement of allAchievements) {
		if (unlockedIds.has(achievement.id)) {
			continue; // already unlocked
		}

		const condition = achievement.condition;

		// check if achievement is triggered by the current event
		if (condition.eventType !== eventType) {
			continue;
		}

		// check condition
		const isUnlocked = await evaluateCondition(userId, condition, eventData);

		if (isUnlocked) {
			await unlockAchievement(userId, achievement);
			unlockedAchievements.push(achievement);
		}
	}

	return unlockedAchievements;
}

// unlock an achievement for a user
async function unlockAchievement(userId: string, achievement: Achievement): Promise<void> {
	await prisma.$transaction(async (tx) => {
		// insert record in db (upsert to handle conflicts)
		await tx.userAchievement.upsert({
			where: {
				userId_achievementId: {
					userId: BigInt(userId),
					achievementId: achievement.id,
				},
			},
			update: {}, // no update if exists
			create: {
				userId: BigInt(userId),
				achievementId: achievement.id,
			},
		});
	});

	// give XP for achievement unlock
	if (achievement.xpReward > 0) {
		await awardXP(userId, achievement.xpReward, `Achievement: ${achievement.name}`);
	}

	await notifyAchievementUnlocked(userId, achievement);
}

// eval achieve condition
async function evaluateCondition(
	userId: string,
	condition: Record<string, unknown>,
	eventData: Record<string, unknown>
): Promise<boolean> {
	const conditionType = condition.type as string;
	const userIdBigInt = BigInt(userId);

	switch (conditionType) {
		case 'PONG_MATCH_COUNT': {
			const requiredCount = condition.count as number;
			const count = await prisma.gamePong.count({
				where: { playerId: userIdBigInt },
			});
			return count >= requiredCount;
		}

		case 'PONG_LOCAL_MATCH_COUNT': {
			const requiredCount = condition.count as number;
			const count = await prisma.gamePong.count({
				where: {
					playerId: userIdBigInt,
					mode: 'LOCAL',
				},
			});
			return count >= requiredCount;
		}

		case 'PONG_WIN_HARD_AI': {
			const count = await prisma.gamePong.count({
				where: {
					playerId: userIdBigInt,
					mode: 'AI',
					difficulty: 'HARD',
					winner: 'PLAYER',
				},
			});
			return count >= 1;
		}

		case 'PONG_PERFECT_WIN_HARD_AI': {
			const count = await prisma.gamePong.count({
				where: {
					playerId: userIdBigInt,
					mode: 'AI',
					difficulty: 'HARD',
					winner: 'PLAYER',
					score1: 5,
					score2: 0,
				},
			});
			return count >= 1;
		}
		
		case 'SESSION_COUNT': {
			const requiredCount = condition.count as number;
			const count = await prisma.session.count({
				where: {
					patientId: userIdBigInt,
					status: 'COMPLETED',
				},
			});
			return count >= requiredCount;
		}

		case 'BREATHE_TOTAL_SECONDS': {
			const requiredSeconds = condition.seconds as number;

			const sessions = await prisma.gameBreathe.findMany({
				where: { playerId: userIdBigInt },
				select: { startedAt: true, endedAt: true },
			});

			const totalSeconds = sessions.reduce((sum, s) => {
				if (!s.startedAt || !s.endedAt) return sum;
				const diffMs = s.endedAt.getTime() - s.startedAt.getTime();
				return sum + Math.max(0, Math.floor(diffMs / 1000));
			}, 0);

			return totalSeconds >= requiredSeconds;
		}

		case 'BREATHE_SESSION_COUNT': {
			const requiredCount = condition.count as number;
			const count = await prisma.gameBreathe.count({
				where: { playerId: userIdBigInt },
			});
			return count >= requiredCount;
		}

		case 'BREATHE_DURATION_MIN': {
			const requiredDuration = condition.duration as number;
			const duration = eventData.duration as number | undefined;
			if (duration === undefined) return false;
			return duration >= requiredDuration;
		}

		case 'STRESS_REDUCTION': {
			const requiredAmount = condition.amount as number;
			const stressReduction = eventData.stressReduction as number | undefined;
			if (stressReduction === undefined) return false;
			return stressReduction >= requiredAmount;
		}

		case 'PONG_FLAWLESS_WIN': {
			const score1 = eventData.score1 as number | undefined;
			const score2 = eventData.score2 as number | undefined;
			const winner = eventData.winner as string | undefined;
			if (score1 === undefined || score2 === undefined || winner !== 'PLAYER') return false;
			return score2 === 0;
		}

		case 'PONG_WIN_STREAK': {
			const requiredStreak = condition.count as number;
			const recentMatches = await prisma.gamePong.findMany({
				where: { playerId: userIdBigInt },
				orderBy: { endedAt: 'desc' },
				take: requiredStreak,
				select: { winner: true },
			});
			if (recentMatches.length < requiredStreak) return false;
			return recentMatches.every(m => m.winner === 'PLAYER');
		}

		case 'PURCHASE_COUNT': {
			const purchaseCount = eventData.purchaseCount as number | undefined;
			const requiredCount = condition.count as number;
			if (purchaseCount !== undefined) {
				return purchaseCount >= requiredCount;
			}
			return false;
		}

		case 'MESSAGE_COUNT':
		case 'CHAT_MESSAGE_COUNT': {
			const requiredCount = condition.count as number;
			const count = await prisma.message.count({
				where: { senderId: userIdBigInt },
			});
			return count >= requiredCount;
		}

		case 'PERFECT_SESSION': {
			const metrics = eventData.metrics as Record<string, number> | undefined;
			if (!metrics) return false;
			return metrics.trust >= 0.9 && metrics.stress < 0.3;
		}

		case 'STREAK': {
			const requiredDays = condition.days as number;
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - requiredDays);

			const sessions = await prisma.session.findMany({
				where: {
					patientId: userIdBigInt,
					status: 'COMPLETED',
					createdAt: {gte: startDate},
				},
				select: {createdAt: true},
			});

			const uniqueDays = new Set(
				sessions.map((s) => s.createdAt.toISOString().split('T')[0])
			);
			return uniqueDays.size >= requiredDays;
		}

		case 'TOTAL_XP': {
			const requiredXP = condition.xp as number;
			const result = await prisma.xpLog.aggregate({
				where: {userId: userIdBigInt},
				_sum: {amount: true},
			});
			return (result._sum.amount || 0) >= requiredXP;
		}

		case 'LEVEL_REACHED': {
			const requiredLevel = condition.level as number;
			const user = await prisma.user.findUnique({
				where: {id: userIdBigInt},
				select: {currentLevel: true},
			});
			return (user?.currentLevel || 0) >= requiredLevel;
		}

		case 'SCENARIO_COMPLETE': {
			const scenarioId = condition.scenarioId as string;
			const count = await prisma.session.count({
				where: {
					patientId: userIdBigInt,
					scenarioId: BigInt(scenarioId),
					status: 'COMPLETED',
				},
			});
			return count >= 1;
		}

		case 'FRIEND_COUNT': {
			const requiredFriends = condition.count as number;
			const count = await prisma.friend.count({
				where: {
					OR: [
						{initiatorId: userIdBigInt},
						{receiverId: userIdBigInt},
					],
					status: 'ACCEPTED',
				},
			});
			return count >= requiredFriends;
		}

		case 'BLOCK_COUNT': {
			const requiredBlocks = condition.count as number;
			const count = await prisma.friend.count({
				where: {
					initiatorId: userIdBigInt,
					status: 'BLOCKED',
				},
			});
			return count >= requiredBlocks;
		}

		case 'COFFEE_OUTCOME': {
			const requiredOutcome = condition.outcome as string;
			const outcome = eventData.outcome as string | undefined;
			if (!outcome) return false;
			return outcome === requiredOutcome;
		}

		case 'HOSPITAL_PATIENTS_SAVED': {
			const requiredCount = condition.count as number;
			const patientsSaved = eventData.patientsSaved as number | undefined;
			if (patientsSaved === undefined) return false;
			return patientsSaved >= requiredCount;
		}

		case 'HOSPITAL_ALL_SAVED': {
			const allSaved = eventData.allSaved as boolean | undefined;
			return allSaved === true;
		}

		default:
			return false;
	}
}

// map db row to achiev
function mapAchievement(row: {
	id: string;
	code: string;
	name: string;
	description: string;
	iconUrl: string | null;
	xpReward: number;
	rarity: string;
	category: string;
	conditionJson: unknown;
	createdAt: Date;
}): Achievement {
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		description: row.description,
		iconUrl: row.iconUrl ?? '',
		xpReward: row.xpReward,
		rarity: row.rarity as Achievement['rarity'],
		category: row.category,
		condition: row.conditionJson as Record<string, unknown>,
		createdAt: row.createdAt,
	};
}

// get achievement progress for a user
export async function getAchievementProgress(
	userId: string,
	achievementId: string
): Promise<{progress: number; total: number; percentage: number}> {
	const allAchievements = await getAllAchievements();
	const achievement = allAchievements.find((a) => a.id === achievementId);

	if (!achievement) {
		throw new Error('Achievement not found');
	}

	const condition = achievement.condition;
	const conditionType = condition.type as string;
	const userIdBigInt = BigInt(userId);

	let progress = 0;
	let total = 1;

	switch (conditionType) {
		case 'PONG_MATCH_COUNT': {
			total = condition.count as number;
			const count = await prisma.gamePong.count({
				where: { playerId: userIdBigInt },
			});
			progress = Math.min(count, total);
			break;
		}

		case 'PONG_LOCAL_MATCH_COUNT': {
			total = condition.count as number;
			const count = await prisma.gamePong.count({
				where: { playerId: userIdBigInt, mode: 'LOCAL' },
			});
			progress = Math.min(count, total);
			break;
		}

		case 'BREATHE_TOTAL_SECONDS': {
			total = condition.seconds as number;

			const sessions = await prisma.gameBreathe.findMany({
				where: { playerId: userIdBigInt },
				select: { startedAt: true, endedAt: true },
			});

			const totalSeconds = sessions.reduce((sum, s) => {
				if (!s.startedAt || !s.endedAt) return sum;
				const diffMs = s.endedAt.getTime() - s.startedAt.getTime();
				return sum + Math.max(0, Math.floor(diffMs / 1000));
			}, 0);

			progress = Math.min(totalSeconds, total);
			break;
		}

		case 'FRIEND_COUNT': {
			total = condition.count as number;
			const count = await prisma.friend.count({
				where: {
					OR: [{ initiatorId: userIdBigInt }, { receiverId: userIdBigInt }],
					status: 'ACCEPTED',
				},
			});
			progress = Math.min(count, total);
			break;
		}

		case 'BLOCK_COUNT': {
			total = condition.count as number;
			const count = await prisma.friend.count({
				where: {
					initiatorId: userIdBigInt,
					status: 'BLOCKED',
				},
			});
			progress = Math.min(count, total);
			break;
		}

		case 'MESSAGE_COUNT':
		case 'CHAT_MESSAGE_COUNT': {
			total = condition.count as number;

			const anyPrisma = prisma as any;
			if (!anyPrisma.message) {
				progress = 0;
				break;
			}

			const count = await anyPrisma.message.count({
				where: { senderId: userIdBigInt },
			});

			progress = Math.min(count, total);
			break;
		}

		case 'SESSION_COUNT': {
			total = condition.count as number;
			const count = await prisma.session.count({
				where: {
					patientId: userIdBigInt,
					status: 'COMPLETED',
				},
			});
			progress = Math.min(count, total);
			break;
		}

		case 'TOTAL_XP': {
			total = condition.xp as number;
			const result = await prisma.xpLog.aggregate({
				where: { userId: userIdBigInt },
				_sum: { amount: true },
			});
			progress = Math.min(result._sum.amount || 0, total);
			break;
		}

		case 'LEVEL_REACHED': {
			total = condition.level as number;
			const user = await prisma.user.findUnique({
				where: { id: userIdBigInt },
				select: { currentLevel: true },
			});
			progress = Math.min(user?.currentLevel || 0, total);
			break;
		}

		case 'STREAK': {
			total = condition.days as number;
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - total);

			const sessions = await prisma.session.findMany({
				where: {
					patientId: userIdBigInt,
					status: 'COMPLETED',
					createdAt: { gte: startDate },
				},
				select: { createdAt: true },
			});

			const uniqueDays = new Set(sessions.map((s) => s.createdAt.toISOString().split('T')[0]));
			progress = Math.min(uniqueDays.size, total);
			break;
		}
	}

	return {
		progress,
		total,
		percentage: Math.round((progress / total) * 100),
	};
}
