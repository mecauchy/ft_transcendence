// packages/shared/types/gamification.ts

// rarity levels
export type AchievementRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

// ach definition
export interface IAchievement {
	id: string;
	code: string;
	name: string;
	description: string;
	iconUrl: string | null;
	xpReward: number;
	rarity: AchievementRarity;
	category: string;
	isHidden: boolean;
}

// user's unlocked achievements
export interface IUserAchievement {
	achievementId: string;
	achievement: IAchievement;
	unlockedAt: Date | string;
	progress: number;
}

// ach progress track
export interface IAchievementProgress {
	achievementId: string;
	name: string;
	isUnlocked: boolean;
	progress: number | null;
}

// user xp summary
export interface IUserXP {
	userId: string;
	totalXP: number;
	level: number;
	xpToNextLevel: number;
	xpProgress: number; // 0-100 percentage
}

// xp log
export interface IXPLog {
	id: string;
	userId: string;
	amount: number;
	reason: string;
	sessionId?: string;
	createdAt: Date | string;
}

// daily xp breakdown
export interface IDailyXP {
	date: string;
	amount: number;
}

// lb entry
export interface ILeaderboardEntry {
	rank: number;
	userId: string;
	displayName: string;
	avatarUrl: string | null;
	level: number;
	totalXP: number;
	score: number;
}

// lb types
export type LeaderboardType = 'XP' | 'LEVEL' | 'SESSIONS' | 'ACHIEVEMENTS' | 'SCENARIO';

// lb response
export interface ILeaderboardResponse {
	type: LeaderboardType;
	entries: ILeaderboardEntry[];
	total: number;
	userRank?: number;
}

// xp reward conditions
export interface IXPRewards {
	SESSION_COMPLETE: number;
	SESSION_PERFECT: number;
	ACHIEVEMENT_UNLOCK: number;
	DAILY_LOGIN: number;
	FIRST_SESSION: number;
}

// notif for levelup event
export interface ILevelUpEvent {
	userId: string;
	previousLevel: number;
	newLevel: number;
	xpGained: number;
	totalXP: number;
}

// notif for achievement unlock event
export interface IAchievementUnlockEvent {
	userId: string;
	achievement: IAchievement;
	unlockedAt: Date | string;
}

// combined stats
export interface IGamificationProfile {
	xp: IUserXP;
	recentAchievements: IUserAchievement[];
	unlockedCount: number;
	totalAchievements: number;
	completionPercentage: number;
	globalRank: number;
	friendsRank?: number;
}
