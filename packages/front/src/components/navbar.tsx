import '../styles/navbar.css';
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback, useRef } from 'react';
import NotificationsDropdown from './NotificationDropdown';
import { api } from '../api/client';
import { useRealtimeNotifications } from '../hooks/useWebSocket';


function NotificationsBell({
	onNavigate,
}: {
	onNavigate?: (page: string, userId?: string) => void;
}) {
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

	const handleNotification = useCallback((notification: unknown) => {
		setUnread((prev) => prev + 1);

		if (notification && typeof notification === 'object') {
			const notif = notification as { title?: string; message?: string };
			console.log(
				'[NotificationsBell] New notification:',
				notif.title || notif.message
			);
		}
	}, []);

	useRealtimeNotifications(handleNotification);

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
					<span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full leading-none animate-pulse">
						{unread}
					</span>
				)}
			</button>

			{open && (
				<NotificationsDropdown
					onClose={() => setOpen(false)}
					onUnreadCountChange={(c) => setUnread(c)}
					onNavigate={(page, userId) => {
						setOpen(false);
						onNavigate?.(page, userId);
					}}
				/>
			)}
		</div>
	);
}


function Navbar({
	setPage,
	username,
}: {
	setPage: (page: string, userId?: string) => void;
	username: string | null;
}) {
	const { t } = useTranslation();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [isCollapsed, setIsCollapsed] = useState(false);

	const navbarRef = useRef<HTMLElement>(null);
	const navLeftRef = useRef<HTMLDivElement>(null);
	const navRightRef = useRef<HTMLDivElement>(null);

	const handleNavClick = (page: string) => {
		setMobileMenuOpen(false);
		setPage(page);
	};

	useEffect(() => {
		const checkCollision = () => {
			if (!navLeftRef.current || !navRightRef.current) return;

			const leftRect = navLeftRef.current.getBoundingClientRect();
			const rightRect = navRightRef.current.getBoundingClientRect();

			const collided = leftRect.right >= rightRect.left - 8;
			setIsCollapsed(collided);
		};

		checkCollision();

		const observer = new ResizeObserver(checkCollision);
		if (navbarRef.current) observer.observe(navbarRef.current);
		if (navLeftRef.current) observer.observe(navLeftRef.current);
		if (navRightRef.current) observer.observe(navRightRef.current);

		window.addEventListener('resize', checkCollision);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', checkCollision);
		};
	}, []);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (
				!target.closest('.mobile-menu') &&
				!target.closest('.hamburger-btn')
			) {
				setMobileMenuOpen(false);
			}
		};

		if (mobileMenuOpen) {
			document.addEventListener('click', handleClickOutside);
		}

		return () => document.removeEventListener('click', handleClickOutside);
	}, [mobileMenuOpen]);

	return (
		<nav ref={navbarRef} className="navbar">
			{/* Logo */}
			<div ref={navLeftRef} className="flex items-center gap-4 min-w-0">
				<img src="/controler.png" alt="Logo" className="logo_image shrink-0" />
				<p className="hidden sm:block mt-5 text-white whitespace-nowrap">
					ft_transcendance
				</p>

				<div className="nav_left hidden md:flex">
					<button
						className="nav_button tournament_box whitespace-nowrap"
						onClick={() => setPage('game')}
					>
						{t('nav.play')}
					</button>
				</div>
			</div>

			{/* Right nav (desktop, no collision) */}
			<div
			ref={navRightRef}
			className={`nav_right hidden md:flex ${
				isCollapsed
					? 'absolute right-0 top-0 pointer-events-none opacity-0'
					: ''
			}`}
			>
				<button className="nav_button" onClick={() => setPage('profile')}>
					{t('nav.profile')}
				</button>
				<button className="nav_button" onClick={() => setPage('history')}>
					{t('nav.history')}
				</button>
				<button className="nav_button" onClick={() => setPage('network')}>
					{t('nav.network')}
				</button>
				<button className="nav_button" onClick={() => setPage('settings')}>
					{t('nav.settings')}
				</button>
				<button className="nav_button" onClick={() => setPage('leaderboard')}>
					{t('nav.leaderboard')}
				</button>
				<NotificationsBell onNavigate={setPage} />
				<button className="nav_button logout" onClick={() => setPage('logout')}>
					{t('nav.logout')} ({username})
				</button>
			</div>

			{/* Collapsed desktop controls */}
			{isCollapsed && (
				<div
					className="hidden md:flex items-center gap-2 ml-auto"
					style={{ minWidth: 0 }}
				>
					<NotificationsBell onNavigate={setPage} />
					<button
						className="hamburger-btn shrink-0 p-2 text-white hover:bg-white/10 rounded-md"
						onClick={() => setMobileMenuOpen((v) => !v)}
						aria-label="Menu"
					>
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							{mobileMenuOpen ? (
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							) : (
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 6h16M4 12h16M4 18h16"
								/>
							)}
						</svg>
					</button>
				</div>
			)}

			{/* Mobile (real mobile) */}
			<div className="flex md:hidden items-center gap-2">
				<NotificationsBell onNavigate={setPage} />
				<button
					className="hamburger-btn p-2 shrink-0 text-white hover:bg-white/10 rounded-md"
					onClick={() => setMobileMenuOpen((v) => !v)}
					aria-label="Menu"
				>
					<svg
						className="w-6 h-6"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						{mobileMenuOpen ? (
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M6 18L18 6M6 6l12 12"
							/>
						) : (
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 6h16M4 12h16M4 18h16"
							/>
						)}
					</svg>
				</button>
			</div>

			{/* Mobile dropdown menu */}
			{mobileMenuOpen && (isCollapsed || window.innerWidth < 768) && (
				<div className="mobile-menu absolute top-full left-0 right-0 bg-[rgba(38,0,58,0.98)] backdrop-blur-lg border-t border-white/10 z-50 shadow-xl">
					<div className="flex flex-col p-4 gap-1">
						<button
							className="mobile-nav-btn play-btn"
							onClick={() => handleNavClick('game')}
						>
							{t('nav.play')}
						</button>
						<button
							className="mobile-nav-btn"
							onClick={() => handleNavClick('profile')}
						>
							{t('nav.profile')}
						</button>
						<button
							className="mobile-nav-btn"
							onClick={() => handleNavClick('history')}
						>
							{t('nav.history')}
						</button>
						<button
							className="mobile-nav-btn"
							onClick={() => handleNavClick('network')}
						>
							{t('nav.network')}
						</button>
						<button
							className="mobile-nav-btn"
							onClick={() => handleNavClick('settings')}
						>
							{t('nav.settings')}
						</button>
						<button
							className="mobile-nav-btn"
							onClick={() => handleNavClick('leaderboard')}
						>
							{t('nav.leaderboard')}
						</button>
						<div className="border-t border-white/10 my-2"></div>
						<button
							className="mobile-nav-btn logout-btn"
							onClick={() => handleNavClick('logout')}
						>
							{t('nav.logout')} ({username})
						</button>
					</div>
				</div>
			)}
		</nav>
	);
}

export default Navbar;