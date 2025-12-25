import { query, getClient } from '../db';
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
	
	const result = await query(
		`SELECT COALESCE(SUM(amount), 0) as total_xp 
		FROM xp_logs 
		WHERE user_id = $1`,
		[userId]
	);
	
	const totalXP = parseInt(result.rows[0].total_xp) || 0;
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
	const client = await getClient();
	
	try {
		await client.query('BEGIN');
		
		// get curr xp for level check
		const beforeXP = await getUserXP(userId);
		
		// xp log
		const result = await client.query(
			`INSERT INTO xp_logs (user_id, amount, reason, session_id)
			VALUES ($1, $2, $3, $4)
			RETURNING *`,
			[userId, amount, reason, sessionId]
		);
		
		const xpLog: XPLog = {
			id: result.rows[0].id,
			userId: result.rows[0].user_id,
			amount: result.rows[0].amount,
			reason: result.rows[0].reason,
			sessionId: result.rows[0].session_id,
			createdAt: result.rows[0].created_at,
		};
		
		// update user level
		const newTotalXP = beforeXP.totalXP + amount;
		const newLevel = calculateLevel(newTotalXP);
		
		await client.query(
			`UPDATE users SET current_level = $1, total_xp = $2, updated_at = NOW()
			WHERE user_id = $3`,
			[newLevel, newTotalXP, userId]
		);
		
		await client.query('COMMIT');
		
		// delete redis cache
		await redis.del(`user:${userId}:xp`);
		
		const levelUp = newLevel > beforeXP.level;
		
		return { xpLog, levelUp, newLevel };
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

// get xp history for a user
export async function getXPHistory(
	userId: string,
	limit: number = 50,
	offset: number = 0
): Promise<XPLog[]> {
	const result = await query(
		`SELECT * FROM xp_logs 
		WHERE user_id = $1 
		ORDER BY created_at DESC 
		LIMIT $2 OFFSET $3`,
		[userId, limit, offset]
	);
	
	return result.rows.map((row) => ({
		id: row.id,
		userId: row.user_id,
		amount: row.amount,
		reason: row.reason,
		sessionId: row.session_id,
		createdAt: row.created_at,
	}));
}

// get daily xp summary
export async function getDailyXP(userId: string, days: number = 30): Promise<{ date: string; amount: number }[]> {
	const result = await query(
		`SELECT DATE(created_at) as date, SUM(amount) as amount
		FROM xp_logs
		WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '${days} days'
		GROUP BY DATE(created_at)
		ORDER BY date DESC`,
		[userId]
	);
	
	return result.rows.map((row) => ({
		date: row.date.toISOString().split('T')[0],
		amount: parseInt(row.amount),
	}));
}
