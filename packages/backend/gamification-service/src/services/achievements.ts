import { query, getClient } from '../db';
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
	
	const result = await query(
		`SELECT * FROM achievements ORDER BY category, rarity`
	);
	
	const achievements = result.rows.map(mapAchievement);
	
	// redis cache for 10m
	await redis.setex('achievements:all', 600, JSON.stringify(achievements));
	
	return achievements;
}

// get user's unlocked achievements
export async function getUserAchievements(userId: string): Promise<UserAchievement[]> {
	const result = await query(
		`SELECT ua.*, a.* 
		FROM user_achievements ua
		JOIN achievements a ON ua.achievement_id = a.id
		WHERE ua.user_id = $1
		ORDER BY ua.unlocked_at DESC`,
		[userId]
	);
	
	return result.rows.map((row) => ({
		achievementId: row.achievement_id,
		achievement: mapAchievement(row),
		unlockedAt: row.unlocked_at,
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
	const client = await getClient();
	
	try {
		await client.query('BEGIN');
		
		// insert record in db
		await client.query(
			`INSERT INTO user_achievements (user_id, achievement_id)
			VALUES ($1, $2)
			ON CONFLICT (user_id, achievement_id) DO NOTHING`,
			[userId, achievement.id]
		);
		
		await client.query('COMMIT');
		
		// give XP for achievement unlock
		if (achievement.xpReward > 0) {
			await awardXP(userId, achievement.xpReward, `Achievement: ${achievement.name}`);
		}
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

// eval achieve condition
async function evaluateCondition(
	userId: string,
	condition: Record<string, unknown>,
	eventData: Record<string, unknown>
): Promise<boolean> {
	const conditionType = condition.type as string;
	
	switch (conditionType) {
		case 'SESSION_COUNT': {
			const requiredCount = condition.count as number;
			const result = await query(
				`SELECT COUNT(*) as count FROM sessions 
				WHERE patient_id = $1 AND status = 'COMPLETED'`,
				[userId]
			);
			return parseInt(result.rows[0].count) >= requiredCount;
		}
		
		case 'PERFECT_SESSION': {
			// if trust >= 0.9 and stress < 0.3
			const metrics = eventData.metrics as Record<string, number> | undefined;
			if (!metrics) return false;
			return metrics.trust >= 0.9 && metrics.stress < 0.3;
		}
		
		case 'STREAK': {
			const requiredDays = condition.days as number;
			const result = await query(
				`SELECT COUNT(DISTINCT DATE(created_at)) as streak_days
				FROM sessions
				WHERE patient_id = $1 
					AND status = 'COMPLETED'
					AND created_at >= NOW() - INTERVAL '${requiredDays} days'`,
				[userId]
			);
			return parseInt(result.rows[0].streak_days) >= requiredDays;
		}
		
		case 'TOTAL_XP': {
			const requiredXP = condition.xp as number;
			const result = await query(
				`SELECT COALESCE(SUM(amount), 0) as total FROM xp_logs WHERE user_id = $1`,
				[userId]
			);
			return parseInt(result.rows[0].total) >= requiredXP;
		}
		
		case 'LEVEL_REACHED': {
			const requiredLevel = condition.level as number;
			const result = await query(
				`SELECT current_level FROM users WHERE user_id = $1`,
				[userId]
			);
			return (result.rows[0]?.current_level || 0) >= requiredLevel;
		}
		
		case 'SCENARIO_COMPLETE': {
			const scenarioId = condition.scenarioId as string;
			const result = await query(
				`SELECT COUNT(*) as count FROM sessions 
				WHERE patient_id = $1 AND scenario_id = $2 AND status = 'COMPLETED'`,
				[userId, scenarioId]
			);
			return parseInt(result.rows[0].count) >= 1;
		}
		
		case 'FRIEND_COUNT': {
			const requiredFriends = condition.count as number;
			const result = await query(
				`SELECT COUNT(*) as count FROM friends 
				WHERE (user1_id = $1 OR user2_id = $1) AND status = 'ACCEPTED'`,
				[userId]
			);
			return parseInt(result.rows[0].count) >= requiredFriends;
		}
		
		default:
			return false;
	}
}

// map db row to achiev
function mapAchievement(row: Record<string, unknown>): Achievement {
	return {
		id: row.id as string,
		code: row.code as string,
		name: row.name as string,
		description: row.description as string,
		iconUrl: row.icon_url as string,
		xpReward: row.xp_reward as number,
		rarity: row.rarity as Achievement['rarity'],
		category: row.category as string,
		condition: row.condition_json as Record<string, unknown>,
		createdAt: row.created_at as Date,
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
	
	let progress = 0;
	let total = 1;
	
	switch (conditionType) {
		case 'SESSION_COUNT': {
			total = condition.count as number;
			const result = await query(
				`SELECT COUNT(*) as count FROM sessions 
				WHERE patient_id = $1 AND status = 'COMPLETED'`,
				[userId]
			);
			progress = Math.min(parseInt(result.rows[0].count), total);
			break;
		}
		
		case 'TOTAL_XP': {
			total = condition.xp as number;
			const result = await query(
				`SELECT COALESCE(SUM(amount), 0) as total FROM xp_logs WHERE user_id = $1`,
				[userId]
			);
			progress = Math.min(parseInt(result.rows[0].total), total);
			break;
		}
		
		case 'LEVEL_REACHED': {
			total = condition.level as number;
			const result = await query(
				`SELECT current_level FROM users WHERE user_id = $1`,
				[userId]
			);
			progress = Math.min(result.rows[0]?.current_level || 0, total);
			break;
		}
		
		case 'FRIEND_COUNT': {
			total = condition.count as number;
			const result = await query(
				`SELECT COUNT(*) as count FROM friends 
				WHERE (user1_id = $1 OR user2_id = $1) AND status = 'ACCEPTED'`,
				[userId]
			);
			progress = Math.min(parseInt(result.rows[0].count), total);
			break;
		}
		
		case 'STREAK': {
			total = condition.days as number;
			const result = await query(
				`SELECT COUNT(DISTINCT DATE(created_at)) as streak_days
				FROM sessions
				WHERE patient_id = $1 AND status = 'COMPLETED'
					AND created_at >= NOW() - INTERVAL '${total} days'`,
				[userId]
			);
			progress = Math.min(parseInt(result.rows[0].streak_days), total);
			break;
		}
	}
	
	return {
		progress,
		total,
		percentage: Math.round((progress / total) * 100),
	};
}
