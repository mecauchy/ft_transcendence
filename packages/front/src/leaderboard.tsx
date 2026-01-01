import {useEffect, useState} from 'react';
import {useAuth} from './contexts/AuthContext';
import {api} from './api/client';
import {useTranslation} from 'react-i18next';

type PongEntry = {
	rank: number;
	playerId: string;
	username: string;
	avatar: string | null;
	games: number;
	wins: number;
	losses: number;
	pointsFor: number;
	pointsAgainst: number;
	durationSeconds: number;
};

function Leaderboard() {
	const {user} = useAuth();
	const {t} = useTranslation();
	const [entries, setEntries] = useState<PongEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const load = async () => {
			setLoading(true);
			setError(null);
			try {
				const res = await api.getPongLeaderboard(50);
				setEntries(res.entries || []);
			} catch (e: unknown) {
				const err = e as {message?: string};
				setError(err.message || 'Failed to load leaderboard');
			}
			setLoading(false);
		};
		load();
	}, []);

	return (
<div className="pt-20 px-6 text-white">
			<h2 className="text-2xl font-bold mb-4">{t('leaderboard')}</h2>
			{error && <p className="text-red-400 mb-4">{error}</p>}
			{loading ? (
<p>{t('common.loading')}</p>
			) : (
<table className="w-full text-left text-sm border-collapse">
					<thead>
						<tr className="border-b border-gray-700">
							<th className="py-2 pr-2">#</th>
							<th className="py-2 pr-2">{t('profile.username') || 'Player'}</th>
							<th className="py-2 pr-2">{t('profile.matches') || 'Games'}</th>
							<th className="py-2 pr-2">{t('profile.wins') || 'W'}</th>
							<th className="py-2 pr-2">{t('profile.losses') || 'L'}</th>
							<th className="py-2 pr-2">{t('profile.pointsFor') || 'PF'}</th>
							<th className="py-2 pr-2">{t('profile.pointsAgainst') || 'PA'}</th>
							<th className="py-2 pr-2">{t('profile.timeSpent') || 'Time (min)'}</th>
						</tr>
					</thead>
					<tbody>
						{entries.length === 0 && (
							<tr>
								<td colSpan={8} className="py-3 text-center text-gray-400">
									{t('notifications.empty') || 'No data'}
								</td>
							</tr>
						)}
						{entries.map((entry) => {
							const isCurrent = user && user.userId === entry.playerId;
							const minutes = Math.round(entry.durationSeconds / 60);
							return (
<tr key={entry.playerId} className={`border-b border-gray-800 ${isCurrent ? 'bg-gray-800/40' : ''}`}>
									<td className="py-2 pr-2 font-semibold">{entry.rank}</td>
									<td className="py-2 pr-2 flex items-center gap-2">
										{entry.avatar ? <img src={entry.avatar} alt="avatar" className="w-6 h-6 rounded-full" /> : <div className="w-6 h-6 rounded-full bg-gray-700" />}
										<span>{entry.username}</span>
									</td>
									<td className="py-2 pr-2">{entry.games}</td>
									<td className="py-2 pr-2 text-green-300">{entry.wins}</td>
									<td className="py-2 pr-2 text-red-300">{entry.losses}</td>
									<td className="py-2 pr-2">{entry.pointsFor}</td>
									<td className="py-2 pr-2">{entry.pointsAgainst}</td>
									<td className="py-2 pr-2">{minutes} {t('profile.minutes') || 'min'}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</div>
	);
}

export default Leaderboard;
