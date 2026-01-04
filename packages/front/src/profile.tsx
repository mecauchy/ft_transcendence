import {useEffect, useState} from 'react';
import {useAuth} from './contexts/AuthContext';
import {api} from './api/client';
import {useTranslation} from 'react-i18next';

type UserProfile = {
	id?: string;
	username: string;
	email: string;
	displayName?: string;
	avatarUrl?: string;
	level?: number;
	totalXp?: number;
	stressLevel?: number;
	confidenceLevel?: number;
	createdAt?: string;
};

type Achievement = {
	id: string;
	code: string;
	name: string;
	description: string;
	rarity: string;
	unlockedAt?: string;
};

type PongStats = {
	games: number;
	wins: number;
	losses: number;
	pointsFor: number;
	pointsAgainst: number;
	totalTime: number;
};

type BreatheStats = {
	sessions: number;
	totalTime: number;
};

// xp formula
function xpForLevel(level: number): number {
	return level * 100;
}

function xpProgress(totalXp: number, level: number): number {
	const prevLevelXp = ((level - 1) * level / 2) * 100;
	const currentLevelXp = totalXp - prevLevelXp;
	const neededForNextLevel = xpForLevel(level);
	return Math.min(100, (currentLevelXp / neededForNextLevel) * 100);
}

// progress bar component
function ProgressBar({value, max, color, label, showValue = true}: {
	value: number;
	max: number;
	color: string;
	label: string;
	showValue?: boolean;
}) {
	const percentage = Math.min(100, Math.max(0, (value / max) * 100));
	return (
		<div className="mb-3">
			<div className="flex justify-between text-sm mb-1">
				<span>{label}</span>
				{showValue && <span>{value}/{max}</span>}
			</div>
			<div className="w-full bg-gray-700 rounded-full h-3">
				<div
					className={`h-3 rounded-full transition-all duration-500 ${color}`}
					style={{width: `${percentage}%`}}
				/>
			</div>
		</div>
	);
}

// meter component for stress and confidence
function Meter({value, label, lowColor, highColor, icon}: {
	value: number;
	label: string;
	lowColor: string;
	highColor: string;
	icon: string;
}) {
	const percentage = Math.min(100, Math.max(0, value));
	const isHigh = percentage > 70;
	const isMid = percentage > 30 && percentage <= 70;

	let barColor = lowColor;
	if (isHigh) barColor = highColor;
	else if (isMid) barColor = 'bg-yellow-500';

	return (
		<div className="flex-1 p-4 bg-white/5 rounded-lg">
			<div className="flex items-center gap-2 mb-2">
				<span className="text-xl">{icon}</span>
				<span className="text-sm font-medium">{label}</span>
			</div>
			<div className="flex items-center gap-3">
				<div className="flex-1 bg-gray-700 rounded-full h-4">
					<div
						className={`h-4 rounded-full transition-all duration-700 ${barColor}`}
						style={{width: `${percentage}%`}}
					/>
				</div>
				<span className="text-lg font-bold w-12 text-right">{percentage}%</span>
			</div>
		</div>
	);
}

// achievement badge component
function AchievementBadge({achievement}: {achievement: Achievement}) {
	const rarityColors: Record<string, string> = {
		COMMON: 'border-gray-400 bg-gray-400/10',
		UNCOMMON: 'border-green-400 bg-green-400/10',
		RARE: 'border-blue-400 bg-blue-400/10',
		EPIC: 'border-purple-400 bg-purple-400/10',
		LEGENDARY: 'border-yellow-400 bg-yellow-400/10',
	};

	const borderColor = rarityColors[achievement.rarity] || rarityColors.COMMON;
	const isUnlocked = !!achievement.unlockedAt;

	return (
		<div
			className={`p-3 rounded-lg border-2 ${borderColor} ${
				isUnlocked ? '' : 'opacity-40 grayscale'
			}`}
			title={achievement.description}
		>
			<div className="text-xs font-semibold truncate">{achievement.name}</div>
			{isUnlocked && (
				<div className="text-[10px] text-gray-400 mt-1">
					{new Date(achievement.unlockedAt!).toLocaleDateString()}
				</div>
			)}
		</div>
	);
}

export default function Profile({userId}: {userId?: string | null}) {
	const {user} = useAuth();
	const {t} = useTranslation();
	const isOwnProfile = !userId || userId === user?.userId;

	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [achievements, setAchievements] = useState<Achievement[]>([]);
	const [pongStats, setPongStats] = useState<PongStats | null>(null);
	const [breatheStats, setBreatheStats] = useState<BreatheStats | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const loadData = async () => {
			setLoading(true);
			setError(null);

			try {
				// load profile - pass userId if viewing someone else
				const profileData = await api.getProfile(isOwnProfile ? undefined : userId!);
				setProfile(profileData);

				// load achievements
				try {
					const achievementsData = await api.getAchievements();
					setAchievements(achievementsData.achievements || []);
				} catch {
					// gamification service may not be available
				}

				// load pong stats from leaderboard
				try {
					const leaderboard = await api.getPongLeaderboard(100);
					const myStats = leaderboard.entries.find(
						(e) => e.playerId === (profileData.id || profileData.userId)?.toString()
					);
					if (myStats) {
						setPongStats({
							games: myStats.games,
							wins: myStats.wins,
							losses: myStats.losses,
							pointsFor: myStats.pointsFor,
							pointsAgainst: myStats.pointsAgainst,
							totalTime: myStats.durationSeconds,
						});
					}
				} catch {
					// no stats found
				}

				// load breathe stats
				try {
					const breatheHistory = await api.getBreatheHistory({
						limit: 50, 
						userId: isOwnProfile ? undefined : userId!
					});
					const sessions = breatheHistory.matches || [];
					let totalTime = 0;
					for (const s of sessions) {
						if (s.startedAt && s.endedAt) {
							totalTime += (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000;
						}
					}
					setBreatheStats({
						sessions: sessions.length,
						totalTime: Math.round(totalTime),
					});
				} catch {
					// no stats found
				}
			} catch (e: unknown) {
				const err = e as {message?: string};
				setError(err.message || 'Failed to load profile');
			}

			setLoading(false);
		};

		if (user) {
			loadData();
		}
	}, [user, userId, isOwnProfile]);

	if (loading) {
		return (
			<div className="pt-20 px-6 text-white flex items-center justify-center min-h-[50vh]">
				<div className="animate-spin text-4xl">⏳</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="pt-20 px-6 text-white">
				<div className="bg-red-500/20 border border-red-500 rounded-lg p-4">
					{error}
				</div>
			</div>
		);
	}

	if (!profile) {
		return null;
	}

	const level = profile.level || 1;
	const totalXp = profile.totalXp || 0;
	const stressLevel = profile.stressLevel ?? 50;
	const confidenceLevel = profile.confidenceLevel ?? 50;

	return (
		<div className="pt-20 px-6 pb-10 text-white max-w-4xl mx-auto">
			{/* Header / Avatar */}
			<div className="flex items-start gap-6 mb-8">
				<div className="relative">
					<div className="w-24 h-24 rounded-full overflow-hidden bg-gray-700 border-4 border-blue-500">
						{profile.avatarUrl ? (
							<img
								src={profile.avatarUrl}
								alt={profile.username}
								className="w-full h-full object-cover"
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center text-4xl">
								👤
							</div>
						)}
					</div>
					<div className="absolute -bottom-2 -right-2 bg-blue-500 rounded-full px-2 py-1 text-xs font-bold">
						Lv.{level}
					</div>
				</div>

				<div className="flex-1">
					<h1 className="text-2xl font-bold">{profile.displayName || profile.username}</h1>
					<p className="text-gray-400">@{profile.username}</p>

					{/* XP Progress */}
					<div className="mt-3">
						<ProgressBar
							value={Math.round(xpProgress(totalXp, level))}
							max={100}
							color="bg-blue-500"
							label={`${t('stats.xp')} - ${t('stats.level')} ${level}`}
							showValue={false}
						/>
						<p className="text-xs text-gray-400">
							{totalXp} XP total • {xpForLevel(level) - Math.round((xpProgress(totalXp, level) / 100) * xpForLevel(level))} XP to next level
						</p>
					</div>
				</div>
			</div>

			{/* Stress & Confidence Meters */}
			<div className="mb-8">
				<h2 className="text-lg font-semibold mb-3">{t('profile.wellness', 'Wellness')}</h2>
				<div className="flex gap-4">
					<Meter
						value={stressLevel}
						label={t('profile.stress', 'Stress Level')}
						lowColor="bg-green-500"
						highColor="bg-red-500"
						icon=""
					/>
					<Meter
						value={confidenceLevel}
						label={t('profile.confidence', 'Confidence')}
						lowColor="bg-red-500"
						highColor="bg-green-500"
						icon=""
					/>
				</div>
			</div>

			{/* Game Stats */}
			<div className="mb-8">
				<h2 className="text-lg font-semibold mb-3">{t('profile.gameStats', 'Game Statistics')}</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* Pong Stats */}
					<div className="p-4 bg-white/5 rounded-lg border border-white/10">
						<h3 className="font-semibold mb-3 flex items-center gap-2">
							 Pong
						</h3>
						{pongStats ? (
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-400">{t('profile.matches', 'Games')}</span>
									<span className="font-semibold">{pongStats.games}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400">{t('profile.wins', 'Wins')}</span>
									<span className="font-semibold text-green-400">{pongStats.wins}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400">{t('profile.losses', 'Losses')}</span>
									<span className="font-semibold text-red-400">{pongStats.losses}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400">{t('profile.winRate', 'Win Rate')}</span>
									<span className="font-semibold">
										{pongStats.games > 0
											? Math.round((pongStats.wins / pongStats.games) * 100)
											: 0}%
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400">{t('profile.timeSpent', 'Time Played')}</span>
									<span className="font-semibold">
										{Math.round(pongStats.totalTime / 60)} {t('profile.minutes', 'min')}
									</span>
								</div>
							</div>
						) : (
							<p className="text-gray-400 text-sm">{t('profile.noGames', 'No games played yet')}</p>
						)}
					</div>

					{/* Breathe Stats */}
					<div className="p-4 bg-white/5 rounded-lg border border-white/10">
						<h3 className="font-semibold mb-3 flex items-center gap-2">
						</h3>
						{breatheStats && breatheStats.sessions > 0 ? (
							<div className="space-y-2 text-sm">
								<div className="flex justify-between">
									<span className="text-gray-400">{t('profile.sessions', 'Sessions')}</span>
									<span className="font-semibold">{breatheStats.sessions}</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400">{t('profile.totalTime', 'Total Time')}</span>
									<span className="font-semibold">
										{Math.round(breatheStats.totalTime / 60)} {t('profile.minutes', 'min')}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-gray-400">{t('profile.avgSession', 'Avg Session')}</span>
									<span className="font-semibold">
										{Math.round(breatheStats.totalTime / breatheStats.sessions / 60)} {t('profile.minutes', 'min')}
									</span>
								</div>
							</div>
						) : (
							<p className="text-gray-400 text-sm">{t('profile.noSessions', 'No sessions yet')}</p>
						)}
					</div>
				</div>
			</div>

			{/* Achievements */}
			<div>
				<h2 className="text-lg font-semibold mb-3">
					{t('profile.achievements', 'Achievements')} ({achievements.filter(a => a.unlockedAt).length}/{achievements.length})
				</h2>
				{achievements.length > 0 ? (
					<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
						{achievements.slice(0, 12).map((achievement) => (
							<AchievementBadge key={achievement.id} achievement={achievement} />
						))}
					</div>
				) : (
					<div className="p-4 bg-white/5 rounded-lg text-gray-400 text-center">
						{t('profile.noAchievements', 'No achievements yet. Start playing to unlock them!')}
					</div>
				)}
			</div>
		</div>
	);
}
