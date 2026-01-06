import { useState, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { api } from "./api/client";
import { useTranslation } from "react-i18next";
import ChatModal from "./components/ChatModal";

type UserPreview = {
id: string;
username: string;
avatarUrl?: string;
status?: 'ONLINE' | 'OFFLINE' | 'IN_SESSION';
};

type BlockedUser = {
id: string;
username: string;
displayName?: string;
avatarUrl?: string;
blockedAt: string;
};

function Network() {
const { user } = useAuth();
const { t } = useTranslation();

const [targetUsername, settargetUsername] = useState("");
const [friends, setFriends] = useState<UserPreview[]>([]);
const [friendRequests, setFriendRequests] = useState<UserPreview[]>([]);
const [pendingRequests, setPendingRequests] = useState<UserPreview[]>([]);
const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
const [refreshKey, setRefreshKey] = useState(0);
const [searchError, setSearchError] = useState<string | null>(null);
const [actionMessage, setActionMessage] = useState<string | null>(null);

// chat modal state
const [chatOpen, setChatOpen] = useState(false);
const [chatUserId, setChatUserId] = useState<string | undefined>(undefined);

// remove friend modal state
const [showRemoveModal, setShowRemoveModal] = useState(false);
const [removingFriend, setRemovingFriend] = useState<UserPreview | null>(null);

// addfriend
const handleAddFriend = async () => {
	if (!targetUsername.trim()) return;
	setSearchError(null);

	try {
		await api.sendFriendRequest(targetUsername);
		setActionMessage(t('network.friendRequestSent'));
		setRefreshKey(prev => prev + 1);
		settargetUsername("");
		setTimeout(() => setActionMessage(null), 3000);
	} catch (error: unknown) {
		if (error instanceof Error)
		setSearchError(error.message || t('network.failedToAddFriend'));
	}
	};

	// block user (from search)
	const handleBlockUser = async () => {
	if (!targetUsername.trim()) return;
	setSearchError(null);

	try {
		// find by username
		const response = await api.searchUser(targetUsername);
		if (response && response.id) {
		await api.blockUser(response.id);
		setActionMessage(t('network.userBlocked'));
		settargetUsername("");
		setRefreshKey(prev => prev + 1);
		setTimeout(() => setActionMessage(null), 3000);
		}
	} catch (error: unknown) {
		if (error instanceof Error)
		setSearchError(error.message || t('network.failedToBlockUser'));
	}
};

// fetch friends + requests
useEffect(() => {
	if (!user) return;

	const fetchFriendsData = async () => {
	try {
		const response = await api.getFriends();

		setFriends(
			response.friends.map((f: {id: string; username: string; avatarUrl?: string; status?: 'ONLINE' | 'OFFLINE' | 'IN_SESSION'}) => ({
			id: f.id,
			username: f.username,
			avatarUrl: f.avatarUrl,
			status: f.status,
		}))
		);

		setFriendRequests(
		response.pendingRequests.map((r: {id: string; username: string}) => ({
			id: r.id,
			username: r.username,
		}))
		);
		setPendingRequests(
		response.sentRequests.map((r: {id: string; username: string}) => ({
			id: r.id,
			username: r.username,
		}))
		);

		// fetch blocked users
		try {
			const blockedResponse = await api.getBlockedUsers();
			setBlockedUsers(blockedResponse.blockedUsers || []);
		} catch (blockedError) {
			console.error("Failed to fetch blocked users:", blockedError);
		}
	} catch (error) {
		console.error("Failed to fetch friends data:", error);
	}
	};

	fetchFriendsData();
}, [user, refreshKey]);

// accept request
const handleAcceptFriend = async (request: UserPreview) => {
	try {
	await api.respondToFriendRequest(request.id, true);
	setRefreshKey(prev => prev + 1);

	setFriendRequests(prev =>
		prev.filter(r => r.id !== request.id)
	);

	setFriends(prev => [...prev, request]);
	} catch (error: unknown) {
	console.error("Failed to accept friend request:", error);
	const err = error as { statusCode?: number };
	if (err.statusCode === 404) {
		// on cancel request
		setFriendRequests(prev => prev.filter(r => r.id !== request.id));
		setActionMessage(t('network.requestNoLongerExists'));
		setTimeout(() => setActionMessage(null), 3000);
	}
	}
};

// decline request
const handleDeclineFriend = async (request: UserPreview) => {
	try {
	await api.respondToFriendRequest(request.id, false);
	setRefreshKey(prev => prev + 1);

	setFriendRequests(prev =>
		prev.filter(r => r.id !== request.id)
	);
	} catch (error: unknown) {
	console.error("Failed to decline friend request:", error);
	const err = error as { statusCode?: number };
	if (err.statusCode === 404) {
		// on cancel request
		setFriendRequests(prev => prev.filter(r => r.id !== request.id));
		setActionMessage(t('network.requestNoLongerExists'));
		setTimeout(() => setActionMessage(null), 3000);
	}
	}
};

// view profile
const handleViewProfile = (friendId: string) => {
	window.history.pushState({page: 'profile', userId: friendId}, '', `/profile/${friendId}`);
	window.dispatchEvent(new PopStateEvent('popstate', {state: {page: 'profile', userId: friendId}}));
};

// start chatting
const handleStartChat = (friend: UserPreview) => {
	setChatUserId(friend.id);

	setChatOpen(true);
};

// remove friend modal
const handleRemoveFriendClick = (friend: UserPreview) => {
	setRemovingFriend(friend);
	setShowRemoveModal(true);
};

// confirm remove friend
const handleRemoveFriend = async () => {
	if (!removingFriend) return;
	try {
	await api.removeFriend(removingFriend.id);
	setFriends(prev => prev.filter(f => f.id !== removingFriend.id));
	setActionMessage(t('network.friendRemoved'));
	setTimeout(() => setActionMessage(null), 3000);
	} catch (error) {
	console.error("Failed to remove friend:", error);
	}
	setShowRemoveModal(false);
	setRemovingFriend(null);
};

// block friend (in modal)
const handleBlockFriend = async () => {
	if (!removingFriend) return;
	try {
	await api.blockUser(removingFriend.id);
	setFriends(prev => prev.filter(f => f.id !== removingFriend.id));
	setActionMessage(t('network.userBlocked'));
	setTimeout(() => setActionMessage(null), 3000);
	} catch (error) {
	console.error("Failed to block friend:", error);
	}
	setShowRemoveModal(false);
	setRemovingFriend(null);
};

// unblock user
const handleUnblockUser = async (userId: string) => {
	try {
		await api.unblockUser(userId);
		setBlockedUsers(prev => prev.filter(u => u.id !== userId));
		setActionMessage(t('network.userUnblocked'));
		setTimeout(() => setActionMessage(null), 3000);
	} catch (error) {
		console.error("Failed to unblock user:", error);
	}
};

// get status color
const getStatusColor = (status?: string) => {
	switch (status) {
	case 'ONLINE': return 'bg-green-500';
	case 'IN_SESSION': return 'bg-yellow-500';
	default: return 'bg-gray-500';
	}
};

// handle given request pending (cancel)
const handleGivenRequestPending = async (request: UserPreview) => {
	try {
		await api.cancelFriendRequest(request.id);
		setPendingRequests(prev =>
			prev.filter(r => r.id !== request.id)
		);
		setActionMessage(t('network.requestCancelled'));
		setTimeout(() => setActionMessage(null), 3000);
	} catch (error: unknown) {
		console.error("Failed to cancel friend request:", error);
		const err = error as { statusCode?: number };
		if (err.statusCode === 404) {
			// already answered the request
			setPendingRequests(prev => prev.filter(r => r.id !== request.id));
			setActionMessage(t('network.requestNoLongerExists'));
			// refresh to see new status
			setRefreshKey(prev => prev + 1);
			setTimeout(() => setActionMessage(null), 3000);
		}
	}
};

// render
return (
	<div className="pt-20 pl-10 text-white">
	<h2 className="text-2xl font-bold mb-4">{t('network.title')}</h2>

	{/* Action message */}
	{actionMessage && (
		<div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded-md text-green-300">
		{actionMessage}
		</div>
	)}

	{/* Search error */}
	{searchError && (
		<div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-md text-red-300">
		{searchError}
		</div>
	)}

	{/* ADD FRIEND / BLOCK */}
	<div className="mb-6">
		<input
		type="text"
		placeholder={t('network.enterFriendUsername')}
		className="border border-gray-300 rounded-md p-2 w-64 text-white bg-transparent focus:bg-purple-600 focus:outline-none"
		value={targetUsername}
		onChange={e => settargetUsername(e.target.value)}
		/>
		<button
		className="ml-2 px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
		onClick={handleAddFriend}
		>
		{t('network.addFriend')}
		</button>
		<button
		className="ml-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
		onClick={handleBlockUser}
		>
		{t('network.block')}
		</button>
	</div>

	{/* FRIEND LIST */}
	<div className="mb-6 bg-white/10 p-4 rounded-md w-full max-w-2xl">
		<h3 className="text-xl font-semibold mb-2">{t('network.friends')}</h3>
		<ul>
		{friends.length === 0 && (
			<li className="text-white/60">{t('network.noFriends')}</li>
		)}
		{friends.map(friend => (
			<li key={friend.id} className="mb-2 flex items-center justify-between bg-white/5 p-3 rounded-md">
			<div className="flex items-center gap-3">
				{/* Avatar with status indicator */}
				<div className="relative">
					{friend.avatarUrl ? (
						<img
							src={friend.avatarUrl}
							alt={friend.username}
							className="w-10 h-10 rounded-full object-cover"
						/>
					) : (
						<div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
							{friend.username[0].toUpperCase()}
						</div>
					)}
					{/* Status indicator circle */}
					<div
						className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusColor(friend.status)}`}
						title={friend.status || 'OFFLINE'}
					/>
				</div>
				<span className="font-medium">{friend.username}</span>
			</div>
			<div className="flex gap-2">
				<button
				className="px-3 py-1 bg-blue-500 rounded hover:bg-blue-600 text-sm"
				onClick={() => handleViewProfile(friend.id)}
				>
				{t('network.viewProfile')}
				</button>
				<button
				className="px-3 py-1 bg-purple-500 rounded hover:bg-purple-600 text-sm"
				onClick={() => handleStartChat(friend)}
				>
				{t('network.chat')}
				</button>
				<button
				className="px-3 py-1 bg-red-500 rounded hover:bg-red-600 text-sm"
				onClick={() => handleRemoveFriendClick(friend)}
				>
				{t('network.remove')}
				</button>
			</div>
			</li>
		))}
		</ul>
	</div>

	{/* FRIEND REQUESTS */}
	<div className="mb-6 bg-white/10 p-4 rounded-md w-full max-w-2xl">
		<h3 className="text-xl font-semibold mb-2">{t('network.friendRequests')}</h3>
		<ul>
		{friendRequests.length === 0 && (
			<li className="text-white/60">{t('network.noPendingRequests')}</li>
		)}
		{friendRequests.map(request => (
			<li
			key={request.id}
			className="mb-2 flex items-center justify-between"
			>
				<span>{request.username}</span>
				<div className="flex gap-2">
				<button
				className="px-2 py-1 bg-green-500 rounded hover:bg-green-600"
				onClick={() => handleAcceptFriend(request)}
				>
					{t('network.accept')}
				</button>
				<button
					className="px-2 py-1 bg-red-500 rounded hover:bg-red-600"
					onClick={() => handleDeclineFriend(request)}
				>
				{t('network.decline')}
				</button>
				</div>
			</li>
		))}
		</ul>
	</div>
	{/* PENDING FRIEND REQUESTS */}
	{pendingRequests.length > 0 && (
	<div className="bg-white/10 p-4 rounded-md w-full max-w-2xl">
		<h3 className="text-xl font-semibold mb-2">{t('network.sentRequests')}</h3>
		<ul>
		{pendingRequests.map(request => (
			<li
			key={request.id}
			className="mb-2 flex items-center justify-between"
			>
				<span>{request.username}
					<button className="px-2 py-1 bg-gray-500 rounded cursor-default hover:bg-gray-600 ml-2"
					onClick={() => handleGivenRequestPending(request)}>
						{t('network.givenRequestPending')}
					</button>
				</span>
			</li>
		))}
		</ul>
	</div>
	)}

	{/* BLOCKED USERS */}
	{blockedUsers.length > 0 && (
	<div className="mt-6 bg-white/10 p-4 rounded-md w-full max-w-2xl">
		<h3 className="text-xl font-semibold mb-2">{t('network.blockedUsers')}</h3>
		<ul>
		{blockedUsers.map(blocked => (
			<li
			key={blocked.id}
			className="mb-2 flex items-center justify-between bg-white/5 p-3 rounded-md"
			>
				<div className="flex items-center gap-3">
					<div className="w-3 h-3 rounded-full bg-red-500" title={t('network.blocked')} />
					<span className="font-medium">{blocked.username}</span>
				</div>
				<button
					className="px-3 py-1 bg-green-600 rounded hover:bg-green-700 text-sm"
					onClick={() => handleUnblockUser(blocked.id)}
				>
					{t('network.unblock')}
				</button>
			</li>
		))}
		</ul>
	</div>
	)}

	{/* Remove Friend Modal */}
	{showRemoveModal && removingFriend && (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
		<div className="bg-gray-800 p-6 rounded-lg w-96">
			<h3 className="text-xl font-bold mb-4">{t('network.removeFriend')}</h3>
			<p className="mb-4">{t('network.removeFriendConfirm', { username: removingFriend.username })}</p>
			<div className="flex flex-col gap-2">
			<button
				className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700"
				onClick={handleRemoveFriend}
			>
				{t('network.unfriend')}
			</button>
			<button
				className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
				onClick={handleBlockFriend}
			>
				{t('network.blockUser')}
			</button>
			<button
				className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-700"
				onClick={() => { setShowRemoveModal(false); setRemovingFriend(null); }}
			>
				{t('common.cancel')}
			</button>
			</div>
		</div>
		</div>
	)}

	{/* Chat Modal */}
	<ChatModal
		isOpen={chatOpen}
		onClose={() => { setChatOpen(false); setChatUserId(undefined); }}
		initialUserId={chatUserId}
	/>

	{/* Floating Chat Button */}
	{!chatOpen && (
		<button
			onClick={() => { setChatUserId(undefined); setChatOpen(true); }}
			className="fixed bottom-6 right-6 w-14 h-14 bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg flex items-center justify-center text-white text-2xl transition-transform hover:scale-110 z-40"
			title={t('network.openChat', 'Open Chat')}
		>
			💬
		</button>
	)}
	</div>
);
}

export default Network;
