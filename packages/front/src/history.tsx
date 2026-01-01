import {useEffect, useState} from 'react';
import {api} from './api/client';
import {useTranslation} from 'react-i18next';

type PongMatch = {
	id: string;
	playerId: string;
	mode: 'AI' | 'LOCAL';
	difficulty: string;
	score1: number;
	score2: number;
	winner: string;
	startedAt: string;
	endedAt: string;
};

type BreatheSession = {
	id: string;
	playerId: string;
	startedAt: string;
	endedAt: string;
};

type GameFilter = 'all' | 'pong' | 'breathe';
type ResultFilter = 'all' | 'wins' | 'losses';

function formatDuration(startedAt: string, endedAt: string): string {
	const start = new Date(startedAt);
	const end = new Date(endedAt);
	const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

export default function MatchHistory() {
	const {t} = useTranslation();

	const [pongMatches, setPongMatches] = useState<PongMatch[]>([]);
	const [breatheSessions, setBreatheSessions] = useState<BreatheSession[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [gameFilter, setGameFilter] = useState<GameFilter>('all');
	const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
	const [pongCursor, setPongCursor] = useState<string | null>(null);
	const [breatheCursor, setBreatheCursor] = useState<string | null>(null);
	const [hasMorePong, setHasMorePong] = useState(true);
	const [hasMoreBreathe, setHasMoreBreathe] = useState(true);

	useEffect(() => {
		const loadHistory = async () => {
			setLoading(true);
			setError(null);

			try {
				// load pong history
				const pongRes = await api.getPongHistory({limit: 20});
				setPongMatches(pongRes.matches || []);
				setPongCursor(pongRes.nextCursor);
				setHasMorePong(!!pongRes.nextCursor);

				// load breathe history
				const breatheRes = await api.getBreatheHistory({limit: 20});
				setBreatheSessions(breatheRes.matches || []);
				setBreatheCursor(breatheRes.nextCursor);
				setHasMoreBreathe(!!breatheRes.nextCursor);
			} catch (e: unknown) {
				const err = e as {message?: string};
				setError(err.message || 'Failed to load history');
			}

			setLoading(false);
		};

		loadHistory();
	}, []);

	// load more pong
	const loadMorePong = async () => {
		if (!pongCursor || !hasMorePong) return;

		try {
			const res = await api.getPongHistory({cursor: pongCursor, limit: 20});
			setPongMatches((prev) => [...prev, ...(res.matches || [])]);
			setPongCursor(res.nextCursor);
			setHasMorePong(!!res.nextCursor);
		} catch (e) {
			console.error('Failed to load more pong matches:', e);
		}
	};

	// load more breathe
	const loadMoreBreathe = async () => {
		if (!breatheCursor || !hasMoreBreathe) return;

		try {
			const res = await api.getBreatheHistory({cursor: breatheCursor, limit: 20});
			setBreatheSessions((prev) => [...prev, ...(res.matches || [])]);
			setBreatheCursor(res.nextCursor);
			setHasMoreBreathe(!!res.nextCursor);
		} catch (e) {
			console.error('Failed to load more breathe sessions:', e);
		}
	};

	// filter pong matches
	const filteredPong = pongMatches.filter((match) => {
		if (resultFilter === 'wins') {
			return match.winner === 'PLAYER' || match.winner === 'PLAYER1';
		}
		if (resultFilter === 'losses') {
			return match.winner !== 'PLAYER' && match.winner !== 'PLAYER1';
		}
		return true;
	});

	// calculate stats
	const pongStats = {
		total: pongMatches.length,
		wins: pongMatches.filter((m) => m.winner === 'PLAYER' || m.winner === 'PLAYER1').length,
		losses: pongMatches.filter((m) => m.winner !== 'PLAYER' && m.winner !== 'PLAYER1').length,
		aiGames: pongMatches.filter((m) => m.mode === 'AI').length,
		localGames: pongMatches.filter((m) => m.mode === 'LOCAL').length,
	};

	const breatheStats = {
		total: breatheSessions.length,
		totalTime: breatheSessions.reduce((acc, s) => {
			if (s.startedAt && s.endedAt) {
				return acc + (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 1000;
			}
			return acc;
		}, 0),
	};

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
				<div className="bg-red-500/20 border border-red-500 rounded-lg p-4">{error}</div>
			</div>
		);
	}

	return (
		<div className="pt-20 px-6 pb-10 text-white max-w-4xl mx-auto">
			<h1 className="text-2xl font-bold mb-6">{t('history.title', 'Match History')}</h1>

			{/* Stats Summary */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<div className="p-4 bg-white/5 rounded-lg text-center">
					<div className="text-3xl font-bold text-blue-400">{pongStats.total}</div>
					<div className="text-sm text-gray-400">Pong Games</div>
				</div>
				<div className="p-4 bg-white/5 rounded-lg text-center">
					<div className="text-3xl font-bold text-green-400">{pongStats.wins}</div>
					<div className="text-sm text-gray-400">{t('profile.wins', 'Wins')}</div>
				</div>
				<div className="p-4 bg-white/5 rounded-lg text-center">
					<div className="text-3xl font-bold text-purple-400">{breatheStats.total}</div>
					<div className="text-sm text-gray-400">Breathe Sessions</div>
				</div>
				<div className="p-4 bg-white/5 rounded-lg text-center">
					<div className="text-3xl font-bold text-cyan-400">
						{Math.round(breatheStats.totalTime / 60)}m
					</div>
					<div className="text-sm text-gray-400">Breathe Time</div>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-wrap gap-4 mb-6">
				<div className="flex items-center gap-2">
					<span className="text-sm text-gray-400">{t('history.game', 'Game')}:</span>
					<select
						value={gameFilter}
						onChange={(e) => setGameFilter(e.target.value as GameFilter)}
						className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm"
					>
						<option value="all">{t('history.all', 'All')}</option>
						<option value="pong">Pong</option>
						<option value="breathe">Breathe</option>
					</select>
				</div>

				{(gameFilter === 'all' || gameFilter === 'pong') && (
					<div className="flex items-center gap-2">
						<span className="text-sm text-gray-400">{t('history.result', 'Result')}:</span>
						<select
							value={resultFilter}
							onChange={(e) => setResultFilter(e.target.value as ResultFilter)}
							className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm"
						>
							<option value="all">{t('history.all', 'All')}</option>
							<option value="wins">{t('profile.wins', 'Wins')}</option>
							<option value="losses">{t('profile.losses', 'Losses')}</option>
						</select>
					</div>
				)}
			</div>

			{/* Pong Matches */}
			{(gameFilter === 'all' || gameFilter === 'pong') && (
				<div className="mb-8">
					<h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
						 Pong Matches ({filteredPong.length})
					</h2>

					{filteredPong.length > 0 ? (
						<div className="space-y-2">
							{filteredPong.map((match) => {
								const isWin = match.winner === 'PLAYER' || match.winner === 'PLAYER1';
								return (
									<div
										key={match.id}
										className={`p-3 rounded-lg border ${
											isWin
												? 'bg-green-500/10 border-green-500/30'
												: 'bg-red-500/10 border-red-500/30'
										}`}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-3">
												<span className={`text-xl ${isWin ? 'text-green-400' : 'text-red-400'}`}>
													{isWin ? 'Win' : 'Loss'}
												</span>
												<div>
													<div className="font-semibold">
														{match.score1} - {match.score2}
													</div>
													<div className="text-xs text-gray-400">
														{match.mode === 'AI' ? `AI (${match.difficulty})` : 'Local 2P'}
													</div>
												</div>
											</div>

											<div className="text-right">
												<div className="text-sm">{formatDuration(match.startedAt, match.endedAt)}</div>
												<div className="text-xs text-gray-400">{formatDate(match.endedAt)}</div>
											</div>
										</div>
									</div>
								);
							})}

							{hasMorePong && (
								<button
									onClick={loadMorePong}
									className="w-full py-2 text-sm text-blue-400 hover:text-blue-300"
								>
									{t('history.loadMore', 'Load more...')}
								</button>
							)}
						</div>
					) : (
						<div className="p-4 bg-white/5 rounded-lg text-gray-400 text-center">
							{t('history.noPong', 'No Pong matches yet')}
						</div>
					)}
				</div>
			)}

			{/* Breathe Sessions */}
			{(gameFilter === 'all' || gameFilter === 'breathe') && (
				<div>
					<h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
						Breathe Sessions ({breatheSessions.length})
					</h2>

					{breatheSessions.length > 0 ? (
						<div className="space-y-2">
							{breatheSessions.map((session) => (
								<div
									key={session.id}
									className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30"
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<span className="text-xl">🌬️</span>
											<div>
												<div className="font-semibold">
													{formatDuration(session.startedAt, session.endedAt)} session
												</div>
												<div className="text-xs text-gray-400">Breathing exercise</div>
											</div>
										</div>

										<div className="text-right">
											<div className="text-xs text-gray-400">{formatDate(session.endedAt)}</div>
										</div>
									</div>
								</div>
							))}

							{hasMoreBreathe && (
								<button
									onClick={loadMoreBreathe}
									className="w-full py-2 text-sm text-purple-400 hover:text-purple-300"
								>
									{t('history.loadMore', 'Load more...')}
								</button>
							)}
						</div>
					) : (
						<div className="p-4 bg-white/5 rounded-lg text-gray-400 text-center">
							{t('history.noBreathe', 'No Breathe sessions yet')}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
