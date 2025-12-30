import { useState, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";
import { api } from "./api/client";
import { useTranslation } from "react-i18next";

//todo : websocket for real-time updates

type UserPreview = {
  id: string;
  username: string;
};

function Network() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [targetUsername, settargetUsername] = useState("");
  const [friends, setFriends] = useState<UserPreview[]>([]);
  const [friendRequests, setFriendRequests] = useState<UserPreview[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Add friend
  const handleAddFriend = async () => {
	if (!targetUsername.trim()) return;

	try {
	  await api.sendFriendRequest(targetUsername);
	  console.log('sent to ' + targetUsername);
	  setRefreshKey(prev => prev + 1);
	  settargetUsername("");
	} catch (error) {
	  console.error("Failed to add friend:", error);
	}
  };

  // Fetch friends + requests
  useEffect(() => {
	if (!user) return;

	const fetchFriendsData = async () => {
	  try {
		const response = await api.getFriends();

		setFriends(
		  response.friends.map((f: {id: string; username: string}) => ({
			id: f.id,
			username: f.username,
		  }))
		);

		setFriendRequests(
		  response.pendingRequests.map((r: {id: string; username: string}) => ({
			id: r.id,
			username: r.username,
		  }))
		);
	  } catch (error) {
		console.error("Failed to fetch friends data:", error);
	  }
	};

	fetchFriendsData();
  }, [user, refreshKey]);

  // Accept request
  const handleAcceptFriend = async (request: UserPreview) => {
	try {
	  await api.respondToFriendRequest(request.id, true);
	  setRefreshKey(prev => prev + 1);

	  setFriendRequests(prev =>
		prev.filter(r => r.id !== request.id)
	  );

	  setFriends(prev => [...prev, request]);
	} catch (error) {
	  console.error("Failed to accept friend request:", error);
	}
  };

  // Decline request
  const handleDeclineFriend = async (request: UserPreview) => {
	try {
	  await api.respondToFriendRequest(request.id, false);
	  setRefreshKey(prev => prev + 1);

	  setFriendRequests(prev =>
		prev.filter(r => r.id !== request.id)
	  );
	} catch (error) {
	  console.error("Failed to decline friend request:", error);
	}
  };

  // Render
  return (
	<div className="pt-20 pl-10 text-white">
	  <h2 className="text-2xl font-bold mb-4">{t('network.title')}</h2>

	  {/* ADD FRIEND */}
	  <div className="mb-6">
		<input
		  type="text"
		  placeholder={t('network.entertargetUsername')}
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
	  </div>

	  {/* FRIEND LIST */}
	  <div className="mb-6 bg-white/10 p-4 rounded-md w-80">
		<h3 className="text-xl font-semibold mb-2">{t('network.friends')}</h3>
		<ul>
		  {friends.length === 0 && (
			<li className="text-white/60">{t('network.noFriends')}</li>
		  )}
		  {friends.map(friend => (
			<li key={friend.id} className="mb-1">
			  {friend.username}
			</li>
		  ))}
		</ul>
	  </div>

	  {/* FRIEND REQUESTS */}
	  <div className="bg-white/10 p-4 rounded-md w-80">
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
	</div>
  );
}

export default Network;
