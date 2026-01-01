import {useState, useEffect} from "react";
import Navbar from "./components/navbar.tsx";
import Game from "./game.tsx";
import Network from "./network.tsx";
import Settings from "./settings.tsx";
import Profile from "./profile.tsx";
import MatchHistory from "./history.tsx";

function Home({username, onLogout}: {username: string | null, onLogout: () => void}) {
	//state
	const getInitialPage = (): string => {
		const current = window.location.pathname.replace("/", "");
		if (["tournament", "game", "network", "settings", "profile", "history"].includes(current)) {
			return current;
		}
		return "game";
	};
	const [page, setPage] = useState<string>(getInitialPage());	
	useEffect(() => {
		window.history.replaceState({page: 'game'}, "", "/game");
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
			}
		};

		window.addEventListener("popstate", handlePopState);
		return () => window.removeEventListener("popstate", handlePopState);
	}, []);

	const changePage = (newPage: string) => {
		setPage(newPage);
		window.history.pushState({page: newPage}, '', `/${newPage}`);
	}

	//render
	  return (
	<div className='home_container'>
		<Navbar setPage={changePage} username={username} />
		{page === 'game' && <Game />}
		{page === 'network' && <Network />}
		{page === 'settings' && <Settings />}
		{page === 'profile' && <Profile />}
		{page === 'history' && <MatchHistory />}
	</div>
  	)
}

export default Home;