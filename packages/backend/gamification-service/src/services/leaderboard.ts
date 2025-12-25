import { query } from '../db';
import Redis from 'ioredis';
import { config } from '../config';

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
	
	let query_sql: string;
	
	switch (type) {
		case 'XP':
			query_sql = `
				SELECT 
					u.user_id,
					u.display_name,
					u.avatar_url,
					u.current_level as level,
					COALESCE(u.total_xp, 0) as total_xp,
					COALESCE(u.total_xp, 0) as score,
					ROW_NUMBER() OVER (ORDER BY COALESCE(u.total_xp, 0) DESC) as rank
				FROM users u
				WHERE u.is_active = true
				ORDER BY score DESC
				LIMIT $1 OFFSET $2
			`;
			break;
			
		case 'LEVEL':
			query_sql = `
				SELECT 
					u.user_id,
					u.display_name,
					u.avatar_url,
					u.current_level as level,
					COALESCE(u.total_xp, 0) as total_xp,
					u.current_level as score,
					ROW_NUMBER() OVER (ORDER BY u.current_level DESC, COALESCE(u.total_xp, 0) DESC) as rank
				FROM users u
				WHERE u.is_active = true
				ORDER BY score DESC, total_xp DESC
				LIMIT $1 OFFSET $2
			`;
			break;
			
		case 'SESSIONS':
			query_sql = `
				SELECT 
					u.user_id,
					u.display_name,
					u.avatar_url,
					u.current_level as level,
					COALESCE(u.total_xp, 0) as total_xp,
					COUNT(s.id) as score,
					ROW_NUMBER() OVER (ORDER BY COUNT(s.id) DESC) as rank
				FROM users u
				LEFT JOIN sessions s ON u.user_id = s.patient_id AND s.status = 'COMPLETED'
				WHERE u.is_active = true
				GROUP BY u.user_id
				ORDER BY score DESC
				LIMIT $1 OFFSET $2
			`;
			break;
			
		case 'ACHIEVEMENTS':
			query_sql = `
				SELECT 
					u.user_id,
					u.display_name,
					u.avatar_url,
					u.current_level as level,
					COALESCE(u.total_xp, 0) as total_xp,
					COUNT(ua.id) as score,
					ROW_NUMBER() OVER (ORDER BY COUNT(ua.id) DESC) as rank
				FROM users u
				LEFT JOIN user_achievements ua ON u.user_id = ua.user_id
				WHERE u.is_active = true
				GROUP BY u.user_id
				ORDER BY score DESC
				LIMIT $1 OFFSET $2
			`;
			break;
			
		default:
			query_sql = `
				SELECT 
					u.user_id,
					u.display_name,
					u.avatar_url,
					u.current_level as level,
					COALESCE(u.total_xp, 0) as total_xp,
					COALESCE(u.total_xp, 0) as score,
					ROW_NUMBER() OVER (ORDER BY COALESCE(u.total_xp, 0) DESC) as rank
				FROM users u
				WHERE u.is_active = true
				ORDER BY score DESC
				LIMIT $1 OFFSET $2
			`;
	}
	
	const result = await query(query_sql, [limit, offset]);
	
	const entries: LeaderboardEntry[] = result.rows.map((row) => ({
		rank: parseInt(row.rank) + offset,
		userId: row.user_id,
		displayName: row.display_name,
		avatarUrl: row.avatar_url,
		level: row.level || 1,
		totalXP: parseInt(row.total_xp) || 0,
		score: parseInt(row.score) || 0,
	}));
	
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
	
	const result = await query(
		`SELECT 
			u.user_id,
			u.display_name,
			u.avatar_url,
			u.current_level as level,
			COALESCE(u.total_xp, 0) as total_xp,
			MAX((s.final_metrics->>'trust')::float * 100) as score,
			ROW_NUMBER() OVER (ORDER BY MAX((s.final_metrics->>'trust')::float) DESC) as rank
		FROM users u
		JOIN sessions s ON u.user_id = s.patient_id
		WHERE s.scenario_id = $1 AND s.status = 'COMPLETED'
		GROUP BY u.user_id
		ORDER BY score DESC
		LIMIT $2 OFFSET $3`,
		[scenarioId, limit, offset]
	);
	
	const entries: LeaderboardEntry[] = result.rows.map((row) => ({
		rank: parseInt(row.rank) + offset,
		userId: row.user_id,
		displayName: row.display_name,
		avatarUrl: row.avatar_url,
		level: row.level || 1,
		totalXP: parseInt(row.total_xp) || 0,
		score: Math.round(parseFloat(row.score) || 0),
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
	
	let subquery: string;
	
	switch (type) {
		case 'XP':
			subquery = `COALESCE(total_xp, 0)`;
			break;
		case 'LEVEL':
			subquery = `current_level`;
			break;
		default:
			subquery = `COALESCE(total_xp, 0)`;
	}
	
	const result = await query(
		`SELECT COUNT(*) + 1 as rank
		FROM users
		WHERE is_active = true 
			AND ${subquery} > (SELECT ${subquery} FROM users WHERE user_id = $1)`,
		[userId]
	);

	const rank = parseInt(result.rows[0].rank);

	await redis.setex(cacheKey, 60, rank.toString()); // 1m cache

	return rank;
}

// get friends leaderboard

export async function getFriendsLeaderboard(
	userId: string,
	limit: number = 50
): Promise<LeaderboardEntry[]> {
	const result = await query(
		`WITH friend_ids AS (
			SELECT CASE 
				WHEN user1_id = $1 THEN user2_id 
				ELSE user1_id 
			END as friend_id
			FROM friends
			WHERE (user1_id = $1 OR user2_id = $1) AND status = 'ACCEPTED'
			UNION
			SELECT $1 as friend_id -- Include self
		)
		SELECT 
			u.user_id,
			u.display_name,
			u.avatar_url,
			u.current_level as level,
			COALESCE(u.total_xp, 0) as total_xp,
			COALESCE(u.total_xp, 0) as score,
			ROW_NUMBER() OVER (ORDER BY COALESCE(u.total_xp, 0) DESC) as rank
		FROM users u
		JOIN friend_ids f ON u.user_id = f.friend_id
		WHERE u.is_active = true
		ORDER BY score DESC
		LIMIT $2`,
		[userId, limit]
	);
	
	return result.rows.map((row) => ({
		rank: parseInt(row.rank),
		userId: row.user_id,
		displayName: row.display_name,
		avatarUrl: row.avatar_url,
		level: row.level || 1,
		totalXP: parseInt(row.total_xp) || 0,
		score: parseInt(row.score) || 0,
	}));
}

// invalidate lb cache
export async function invalidateLeaderboardCaches(): Promise<void> {
	const keys = await redis.keys('leaderboard:*');
	if (keys.length > 0) {
		await redis.del(...keys);
	}
}
