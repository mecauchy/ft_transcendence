import {useState, useEffect} from "react";
import Navbar from "./components/navbar.tsx";
import Footer from "./components/Footer.tsx";
import AchievementPopup from "./components/AchievementPopup.tsx";
import Game from "./game.tsx";
import Network from "./network.tsx";
import Settings from "./settings.tsx";
import Profile from "./profile.tsx";
import MatchHistory from "./history.tsx";
import Leaderboard from "./leaderboard.tsx";
import { PrivacyPolicy, TermsOfService } from "./legal";

function Home({username, onLogout}: {username: string | null, onLogout: () => void}) {
	//state
	const getInitialPage = (): string => {
		const path = window.location.pathname;
		const current = path.replace("/", "");
		if (["tournament", "game", "network", "settings", "profile", "history", "leaderboard", "privacy", "terms"].includes(current)) {
			return current;
		}
		if (path.startsWith('/profile/')) {
			return 'profile';
		}
		return "game";
	};

	const getProfileUserId = (): string | null => {
		const path = window.location.pathname;
		const match = path.match(/^\/profile\/(\d+)$/);
		return match ? match[1] : null;
	};

	const [page, setPage] = useState<string>(getInitialPage());
	const [viewingUserId, setViewingUserId] = useState<string | null>(getProfileUserId());
	
	useEffect(() => {
		if (window.location.pathname === '/') {
			window.history.replaceState({page: 'game'}, "", "/game");
		}
	}, []);
	
	//handlers
	useEffect(() => {
		if (page === 'logout') {
			onLogout();
		}
	}, [page, onLogout]);

	useEffect(() => {
		const handlePopState = (event: PopStateEvent) => {
			if (event.state?.page) {
				setPage(event.state.page);
				setViewingUserId(event.state.userId || null);
			}
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const changePage = (newPage: string, userId?: string) => {
		setPage(newPage);
		setViewingUserId(userId || null);
		if (userId && newPage === 'profile') {
			window.history.pushState({page: newPage, userId}, '', `/profile/${userId}`);
		} else {
			window.history.pushState({page: newPage}, '', `/${newPage}`);
		}
	}

	//render
	  return (
	<div className='home_container pb-14'>
		<Navbar setPage={changePage} username={username} />
		{page === 'game' && <Game />}
		{page === 'network' && <Network />}
		{page === 'settings' && <Settings />}
		{page === 'profile' && <Profile userId={viewingUserId} />}
		{page === 'history' && <MatchHistory />}
		{page === 'leaderboard' && <Leaderboard />}
		{page === 'privacy' && <PrivacyPolicy />}
		{page === 'terms' && <TermsOfService />}
		<AchievementPopup />
		<Footer setPage={changePage} />
	</div>
  	)
}

export default Home;