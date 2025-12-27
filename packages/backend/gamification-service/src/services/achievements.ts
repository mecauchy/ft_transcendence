import { prisma } from '../db';
import Redis from 'ioredis';
import { config } from '../config';
import { awardXP } from './xp';

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

// get all avail achievements
export async function getAllAchievements(): Promise<Achievement[]> {
	const cached = await redis.get('achievements:all');
	if (cached) {
		return JSON.parse(cached);
	}
	
	const rows = await prisma.achievement.findMany({
		orderBy: [{ category: 'asc' }, { rarity: 'asc' }],
	});
	
	const achievements = rows.map(mapAchievement);
	
	// redis cache for 10m
	await redis.setex('achievements:all', 600, JSON.stringify(achievements));
	
	return achievements;
}

// get user's unlocked achievements
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
	const rows = await prisma.userAchievement.findMany({
		where: { userId: BigInt(userId) },
		include: { achievement: true },
		orderBy: { unlockedAt: 'desc' },
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
		
		case 'PERFECT_SESSION': {
			// if trust >= 0.9 and stress < 0.3
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
					createdAt: { gte: startDate },
				},
				select: { createdAt: true },
			});
			
			const uniqueDays = new Set(
				sessions.map((s) => s.createdAt.toISOString().split('T')[0])
			);
			return uniqueDays.size >= requiredDays;
		}
		
		case 'TOTAL_XP': {
			const requiredXP = condition.xp as number;
			const result = await prisma.xpLog.aggregate({
				where: { userId: userIdBigInt },
				_sum: { amount: true },
			});
			return (result._sum.amount || 0) >= requiredXP;
		}
		
		case 'LEVEL_REACHED': {
			const requiredLevel = condition.level as number;
			const user = await prisma.user.findUnique({
				where: { id: userIdBigInt },
				select: { currentLevel: true },
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
						{ initiatorId: userIdBigInt },
						{ receiverId: userIdBigInt },
					],
					status: 'ACCEPTED',
				},
			});
			return count >= requiredFriends;
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
): Promise<{ progress: number; total: number; percentage: number }> {
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
		
		case 'FRIEND_COUNT': {
			total = condition.count as number;
			const count = await prisma.friend.count({
				where: {
					OR: [
						{ initiatorId: userIdBigInt },
						{ receiverId: userIdBigInt },
					],
					status: 'ACCEPTED',
				},
			});
			progress = Math.min(count, total);
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
			
			const uniqueDays = new Set(
				sessions.map((s) => s.createdAt.toISOString().split('T')[0])
			);
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
