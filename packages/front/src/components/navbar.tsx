import '../styles/navbar.css'
import {useTranslation} from 'react-i18next'
import { useEffect, useState } from 'react';
import NotificationsDropdown from './NotificationDropdown';
import { api } from '../api/client';


function NotificationsBell() {
	const [open, setOpen] = useState(false);
	const [unread, setUnread] = useState(0);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const res = await api.getUnreadNotificationCount();
				if (mounted) setUnread(res.unreadCount);
			} catch {
				// ignore
			}
		})();
		return () => {
			mounted = false;
		};
	}, []);

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="relative p-2 rounded-md hover:bg-white/10 text-white"
				aria-label="Notifications"
			>
				<span className="text-lg">🔔</span>
				{unread > 0 && (
					<span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full leading-none">
						{unread}
					</span>
				)}
			</button>

			{open && (
				<NotificationsDropdown
					onClose={() => setOpen(false)}
					onUnreadCountChange={(c) => setUnread(c)}
				/>
			)}
		</div>
	);
}

function Navbar({setPage, username}: {setPage: (page: string) => void, username: string | null}) {
	  const {t} = useTranslation();
	  
	  return (
		<nav className="navbar">
  			<div className="flex">
				<img src="/controler.png" alt="Logo" className="logo_image" />
				<p className="mt-5 text-white">
					ft_transcendance
				</p>
			</div>

  			<div className="nav_left">
  			  <button className="nav_button tournament_box" onClick={() => setPage("game")}>
  			    {t('nav.play')}
  			  </button>

  			</div>

  			<div className="nav_right">
  			  <button className="nav_button" onClick={() => setPage("profile")}>{t('nav.profile')}</button>
  			  <button className="nav_button" onClick={() => setPage("history")}>{t('nav.history')}</button>
  			  <button className="nav_button" onClick={() => setPage("network")}>{t('nav.network')}</button>
  			  <button className="nav_button" onClick={() => setPage("settings")}>{t('nav.settings')}</button>
  			  <button className="nav_button" onClick={() => setPage("leaderboard")}>{t('nav.leaderboard')}</button>
			  <NotificationsBell />
  			  <button className="nav_button logout" onClick={() => setPage("logout")}>
  			    {t('nav.logout')} ({username})
  			  </button>
  			</div>
		</nav>

  )
}

export default Navbar;