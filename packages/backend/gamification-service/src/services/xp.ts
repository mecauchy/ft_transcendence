import { prisma } from '../db';
import { config } from '../config';
import Redis from 'ioredis';

const redis = new Redis({
	host: config.redis.host,
	port: config.redis.port,
});

export interface XPLog {
	id: string;
	userId: string;
	amount: number;
	reason: string;
	sessionId?: string;
	createdAt: Date;
}

export interface UserXP {
	userId: string;
	totalXP: number;
	level: number;
	xpToNextLevel: number;
	xpProgress: number; // percentage 0-100
}

// get level from total xp
export function calculateLevel(totalXP: number): number {
	let level = 1;
	let xpNeeded = 0;
	
	while (xpNeeded <= totalXP) {
		xpNeeded += config.gamification.xpPerLevel(level);
		if (xpNeeded <= totalXP) {
			level++;
		}
	}
	
	return level;
}

// xp needed for level
export function xpForLevel(level: number): number {
	let total = 0;
	for (let i = 1; i < level; i++) {
		total += config.gamification.xpPerLevel(i);
	}
	return total;
}

// user xp summary
export async function getUserXP(userId: string): Promise<UserXP> {
	// check redis if avail
	const cached = await redis.get(`user:${userId}:xp`);
	if (cached) {
		return JSON.parse(cached);
	}
	
	const result = await prisma.xpLog.aggregate({
		where: { userId: BigInt(userId) },
		_sum: { amount: true },
	});
	
	const totalXP = result._sum.amount || 0;
	const level = calculateLevel(totalXP);
	const xpForCurrentLevel = xpForLevel(level);
	const xpForNextLevel = xpForLevel(level + 1);
	const xpInCurrentLevel = totalXP - xpForCurrentLevel;
	const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
	
	const userXP: UserXP = {
		userId,
		totalXP,
		level,
		xpToNextLevel: xpNeededForNext - xpInCurrentLevel,
		xpProgress: Math.round((xpInCurrentLevel / xpNeededForNext) * 100),
	};
	
	// cache for 1m
	await redis.setex(`user:${userId}:xp`, 60, JSON.stringify(userXP));
	
	return userXP;
}

// award a user xp
export async function awardXP(
	userId: string,
	amount: number,
	reason: string,
	sessionId?: string
): Promise<{ xpLog: XPLog; levelUp: boolean; newLevel: number }> {
	// get curr xp for level check
	const beforeXP = await getUserXP(userId);
	const userIdBigInt = BigInt(userId);
	
	// use transaction
	const xpLogRecord = await prisma.$transaction(async (tx) => {
		// create xp log
		const log = await tx.xpLog.create({
			data: {
				userId: userIdBigInt,
				amount,
				reason,
				sessionId: sessionId ?? null,
			},
		});
		
		// update user level
		const newTotalXP = beforeXP.totalXP + amount;
		const newLevel = calculateLevel(newTotalXP);
		
		await tx.user.update({
			where: { id: userIdBigInt },
			data: {
				currentLevel: newLevel,
				totalXp: newTotalXP,
				updatedAt: new Date(),
			},
		});
		
		return log;
	});
	
	const xpLog: XPLog = {
		id: xpLogRecord.id.toString(),
		userId: xpLogRecord.userId.toString(),
		amount: xpLogRecord.amount,
		reason: xpLogRecord.reason,
		sessionId: xpLogRecord.sessionId?.toString(),
		createdAt: xpLogRecord.createdAt,
	};
	
	// delete redis cache
	await redis.del(`user:${userId}:xp`);
	
	const newTotalXP = beforeXP.totalXP + amount;
	const newLevel = calculateLevel(newTotalXP);
	const levelUp = newLevel > beforeXP.level;
	
	return { xpLog, levelUp, newLevel };
}

// get xp history for a user
export async function getXPHistory(
	userId: string,
	limit: number = 50,
	offset: number = 0
): Promise<XPLog[]> {
	const logs = await prisma.xpLog.findMany({
		where: { userId: BigInt(userId) },
		orderBy: { createdAt: 'desc' },
		take: limit,
		skip: offset,
	});
	
	return logs.map((row) => ({
		id: row.id.toString(),
		userId: row.userId.toString(),
		amount: row.amount,
		reason: row.reason,
		sessionId: row.sessionId?.toString(),
		createdAt: row.createdAt,
	}));
}

// get daily xp summary
export async function getDailyXP(userId: string, days: number = 30): Promise<{ date: string; amount: number }[]> {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);
	
	const logs = await prisma.xpLog.findMany({
		where: {
			userId: BigInt(userId),
			createdAt: { gte: startDate },
		},
		orderBy: { createdAt: 'desc' },
	});
	
	// group by date
	const dailyMap = new Map<string, number>();
	for (const log of logs) {
		const dateKey = log.createdAt.toISOString().split('T')[0];
		dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + log.amount);
	}
	
	return Array.from(dailyMap.entries())
		.map(([date, amount]) => ({ date, amount }))
		.sort((a, b) => b.date.localeCompare(a.date));
}
