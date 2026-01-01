import {useEffect, useMemo, useRef, useState} from 'react';
import {api} from '../api/client';
import {useTranslation} from 'react-i18next';

type NotificationItem = {
	id: string;
	type: string;
	title: string;
	message: string;
	data: any;
	isRead: boolean;
	createdAt: string;
};

function formatTime(iso: string) {
	const d = new Date(iso);
	return d.toLocaleString();
}

export default function NotificationsDropdown({
	onUnreadCountChange,
	onClose,
}: {
	onUnreadCountChange?: (count: number) => void;
	onClose?: () => void;
}) {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [items, setItems] = useState<NotificationItem[]>([]);
	const [unreadCount, setUnreadCount] = useState(0);

	const dropdownRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const onClickOutside = (e: MouseEvent) => {
			if (!dropdownRef.current) return;
			if (!dropdownRef.current.contains(e.target as Node)) onClose?.();
		};
		document.addEventListener('mousedown', onClickOutside);
		return () => document.removeEventListener('mousedown', onClickOutside);
	}, [onClose]);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const res = await api.getNotifications({ limit: 20, offset: 0 });
				if (!mounted) return;
				setItems(res.notifications);
				setUnreadCount(res.unreadCount);
				onUnreadCountChange?.(res.unreadCount);
			} finally {
				if (mounted) setLoading(false);
			}
		})();
		return () => {
			mounted = false;
		};
	}, [onUnreadCountChange]);

	const hasAny = items.length > 0;

	const markOneRead = async (id: string) => {
		const target = items.find((n) => n.id === id);
		if (!target || target.isRead) return;

		setBusy(true);
		try {
			await api.markNotificationRead(id);
			setItems((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));

			setUnreadCount((c) => {
				const next = Math.max(0, c - 1);
				onUnreadCountChange?.(next);
				return next;
			});
		} finally {
			setBusy(false);
		}
	};

	const markAllRead = async () => {
		if (unreadCount === 0) return;
		setBusy(true);
		try {
			await api.markAllNotificationsRead();
			setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
			setUnreadCount(0);
			onUnreadCountChange?.(0);
		} finally {
			setBusy(false);
		}
	};

	const deleteOne = async (id: string) => {
		setBusy(true);
		try {
			const target = items.find((n) => n.id === id);
			await api.deleteNotification(id);
			setItems((prev) => prev.filter((n) => n.id !== id));

			if (target && !target.isRead) {
				setUnreadCount((c) => {
					const next = Math.max(0, c - 1);
					onUnreadCountChange?.(next);
					return next;
				});
			}
		} finally {
			setBusy(false);
		}
	};

	const deleteAll = async () => {
		if (!hasAny) return;
		setBusy(true);
		try {
			await api.deleteAllNotifications();
			setItems([]);
			setUnreadCount(0);
			onUnreadCountChange?.(0);
		} finally {
			setBusy(false);
		}
	};

	const headerTitle = useMemo(() => t('notifications.title', 'Notifications'), [t]);

	return (
		<div
			ref={dropdownRef}
			className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] rounded-lg border border-white/10 bg-slate-950/95 shadow-xl backdrop-blur z-50"
		>
			<div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold text-white">{headerTitle}</h3>
					{unreadCount > 0 && (
						<span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/90 text-white">
							{unreadCount}
						</span>
					)}
				</div>

				<div className="flex items-center gap-2">
					<button
						onClick={markAllRead}
						disabled={busy || unreadCount === 0}
						className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white disabled:opacity-40"
					>
						{t('notifications.markAllRead', 'Mark all read')}
					</button>
					<button
						onClick={deleteAll}
						disabled={busy || !hasAny}
						className="text-xs px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/25 text-red-200 disabled:opacity-40"
					>
						{t('notifications.clearAll', 'Clear')}
					</button>
				</div>
			</div>

			<div className="max-h-96 overflow-auto">
				{loading && (
					<div className="px-4 py-6 text-sm text-white/70">{t('common.loading', 'Loading...')}</div>
				)}

				{!loading && !hasAny && (
					<div className="px-4 py-6 text-sm text-white/70">{t('notifications.empty', 'No notifications')}</div>
				)}

				{!loading &&
					items.map((n) => (
						<div
							key={n.id}
							className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition ${
								!n.isRead ? 'bg-white/[0.06]' : ''
							}`}
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<div className={`text-sm ${!n.isRead ? 'font-semibold text-white' : 'text-white/90'}`}>
										{n.title}
									</div>
									<div className="text-xs text-white/70 mt-0.5 break-words">{n.message}</div>
									<div className="text-[11px] text-white/50 mt-1">{formatTime(n.createdAt)}</div>
								</div>

								<div className="flex flex-col gap-2 shrink-0">
									{!n.isRead && (
										<button
											onClick={() => markOneRead(n.id)}
											disabled={busy}
											className="text-[11px] px-2 py-1 rounded-md bg-white/10 hover:bg-white/15 text-white disabled:opacity-40"
										>
											{t('notifications.read', 'Read')}
										</button>
									)}
									<button
										onClick={() => deleteOne(n.id)}
										disabled={busy}
										className="text-[11px] px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/25 text-red-200 disabled:opacity-40"
									>
										{t('common.delete', 'Delete')}
									</button>
								</div>
							</div>
						</div>
					))}
			</div>
		</div>
	);
}
