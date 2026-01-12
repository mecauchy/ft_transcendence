import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { wsService } from '../services/websocket';

interface Achievement {
	code: string;
	name: string;
	description: string;
	xpReward: number;
	rarity: string;
}

interface AchievementPopupProps {
	achievement: Achievement | null;
	onClose: () => void;
}

const rarityColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
	COMMON: {
		bg: 'bg-gray-800',
		border: 'border-gray-500',
		text: 'text-gray-300',
		glow: 'shadow-gray-500/50',
	},
	UNCOMMON: {
		bg: 'bg-green-900',
		border: 'border-green-500',
		text: 'text-green-300',
		glow: 'shadow-green-500/50',
	},
	RARE: {
		bg: 'bg-blue-900',
		border: 'border-blue-500',
		text: 'text-blue-300',
		glow: 'shadow-blue-500/50',
	},
	EPIC: {
		bg: 'bg-purple-900',
		border: 'border-purple-500',
		text: 'text-purple-300',
		glow: 'shadow-purple-500/50',
	},
	LEGENDARY: {
		bg: 'bg-yellow-900',
		border: 'border-yellow-500',
		text: 'text-yellow-300',
		glow: 'shadow-yellow-500/50',
	},
};

function AchievementPopupCard({ achievement, onClose }: AchievementPopupProps) {
	const { t } = useTranslation();
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		if (achievement) {
			requestAnimationFrame(() => setIsVisible(true));

			const timer = setTimeout(() => {
				setIsVisible(false);
				setTimeout(onClose, 300);
			}, 5000);
			
			return () => clearTimeout(timer);
		}
	}, [achievement, onClose]);

	if (!achievement) return null;

	const colors = rarityColors[achievement.rarity] || rarityColors.COMMON;

	return (
		<div
			className={`fixed top-20 right-4 z-[100] transform transition-all duration-300 ease-out ${
				isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
			}`}
		>
			<div
				className={`${colors.bg} ${colors.border} border-2 rounded-lg p-4 min-w-[300px] max-w-[400px] shadow-lg ${colors.glow}`}
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<span className="text-2xl"></span>
						<span className={`text-sm font-bold uppercase ${colors.text}`}>
							{achievement.rarity}
						</span>
					</div>
					<button
						onClick={() => {
							setIsVisible(false);
							setTimeout(onClose, 300);
						}}
						className="text-gray-400 hover:text-white transition-colors"
					>
						✕
					</button>
				</div>

				{/* Achievement Name */}
				<h3 className="text-lg font-bold text-white mb-1">
					{t('achievements.unlocked', 'Achievement Unlocked!')}
				</h3>
				<h4 className="text-xl font-semibold text-white mb-2">
					{achievement.name}
				</h4>

				{/* Description */}
				<p className="text-gray-300 text-sm mb-3">
					{achievement.description}
				</p>

				{/* XP Reward */}
				{achievement.xpReward > 0 && (
					<div className="flex items-center gap-2 text-yellow-400">
						<span></span>
						<span className="font-semibold">+{achievement.xpReward} XP</span>
					</div>
				)}
			</div>
		</div>
	);
}

// Achievement popup manager that listens to WebSocket events
export default function AchievementPopup() {
	const [achievement, setAchievement] = useState<Achievement | null>(null);
	const [queue, setQueue] = useState<Achievement[]>([]);

	const showNextAchievement = useCallback(() => {
		setQueue((prev) => {
			if (prev.length > 0) {
				const [next, ...rest] = prev;
				setAchievement(next);
				return rest;
			}
			return prev;
		});
	}, []);

	const handleClose = useCallback(() => {
		setAchievement(null);
		// Show next achievement after a short delay
		setTimeout(showNextAchievement, 500);
	}, [showNextAchievement]);

	useEffect(() => {
		const unsubscribe = wsService.on('ACHIEVEMENT_UNLOCKED', (message) => {
			console.log('[AchievementPopup] Received achievement:', message);
			const data = message.data as Achievement;
			if (data) {
				if (achievement) {
					// Queue the achievement if one is already showing
					setQueue((prev) => [...prev, data]);
				} else {
					setAchievement(data);
				}
			}
		});

		return () => {
			unsubscribe();
		};
	}, [achievement]);

	return <AchievementPopupCard achievement={achievement} onClose={handleClose} />;
}
