import {useEffect, useRef, useState} from 'react';
import {api} from '../api/client';
import {useTranslation} from 'react-i18next';

type Conversation = {
	id: string;
	otherUser: {
		id: string;
		username: string;
		avatar: string;
		isOnline?: boolean;
	};
	lastMessage?: {
		content: string;
		createdAt: string;
	};
	unreadCount: number;
};

type Message = {
	id: string;
	senderId: string;
	receiverId: string;
	content: string;
	createdAt: string;
	read: boolean;
};

type ChatModalProps = {
	isOpen: boolean;
	onClose: () => void;
	initialUserId?: string;
};

export default function ChatModal({isOpen, onClose, initialUserId}: ChatModalProps) {
	const {t} = useTranslation();

	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [newMessage, setNewMessage] = useState('');
	const [loading, setLoading] = useState(true);
	const [sending, setSending] = useState(false);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// load chat
	useEffect(() => {
		if (!isOpen) return;

		const loadConversations = async () => {
			setLoading(true);
			try {
				const res = await api.getConversations();
				setConversations(res.conversations || []);

				// find or create conversation based on uid
				if (initialUserId) {
					const existing = res.conversations?.find(
						(c: Conversation) => c.otherUser.id === initialUserId
					);
					if (existing) {
						setSelectedConversation(existing);
					} else {
						// new convo placeholder
						const userRes = await api.getProfile();
						setSelectedConversation({
							id: 'new',
							otherUser: {
								id: initialUserId,
								username: 'User',
								avatar: '',
							},
							unreadCount: 0,
						});
					}
				}
			} catch (e) {
				console.error('Failed to load conversations:', e);
			}
			setLoading(false);
		};

		loadConversations();
	}, [isOpen, initialUserId]);

	// load convo on select
	useEffect(() => {
		if (!selectedConversation || selectedConversation.id === 'new') {
			setMessages([]);
			return;
		}

		const loadMessages = async () => {
			try {
				const res = await api.getMessages(selectedConversation.id);
				setMessages(res.messages || []);
				setCursor(res.nextCursor);
				setHasMore(!!res.nextCursor);
			} catch (e) {
				console.error('Failed to load messages:', e);
			}
		};

		loadMessages();
	}, [selectedConversation]);

	// scroll to bottom when new message (autoscroll)
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
	}, [messages]);

	// focus input into chatwindow
	useEffect(() => {
		if (selectedConversation) {
			inputRef.current?.focus();
		}
	}, [selectedConversation]);

	// load more msgs
	const loadMore = async () => {
		if (!selectedConversation || !cursor || !hasMore) return;

		try {
			const res = await api.getMessages(selectedConversation.id, cursor);
			setMessages((prev) => [...(res.messages || []), ...prev]);
			setCursor(res.nextCursor);
			setHasMore(!!res.nextCursor);
		} catch (e) {
			console.error('Failed to load more messages:', e);
		}
	};

	// send a message
	const handleSend = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newMessage.trim() || !selectedConversation || sending) return;

		setSending(true);
		try {
			const res = await api.sendMessage(selectedConversation.otherUser.id, newMessage.trim());

			// add msg to list
			setMessages((prev) => [...prev, res.message]);
			setNewMessage('');

			// update conversation
			setConversations((prev) =>
				prev.map((c) =>
					c.id === selectedConversation.id || c.otherUser.id === selectedConversation.otherUser.id
						? {
								...c,
								id: res.message.conversationId || c.id,
								lastMessage: {
									content: res.message.content,
									createdAt: res.message.createdAt,
								},
						  }
						: c
				)
			);

			// if newconvo, update id
			if (selectedConversation.id === 'new') {
				setSelectedConversation((prev) =>
					prev ? {...prev, id: res.message.conversationId} : prev
				);
			}
		} catch (e) {
			console.error('Failed to send message:', e);
		}
		setSending(false);
	};

	// time formatting
	const formatTime = (dateStr: string) => {
		const date = new Date(dateStr);
		const now = new Date();
		const isToday = date.toDateString() === now.toDateString();

		if (isToday) {
			return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
		}

		const yesterday = new Date(now);
		yesterday.setDate(yesterday.getDate() - 1);
		if (date.toDateString() === yesterday.toDateString()) {
			return `${t('chat.yesterday', 'Yesterday')} ${date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
		}

		return date.toLocaleDateString([], {month: 'short', day: 'numeric'});
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
			<div className="bg-gray-900 rounded-lg w-full max-w-4xl h-[600px] flex overflow-hidden">
				{/* Conversation List */}
				<div className="w-80 border-r border-gray-700 flex flex-col">
					<div className="p-4 border-b border-gray-700">
						<h2 className="text-lg font-semibold">{t('chat.title', 'Messages')}</h2>
					</div>

					<div className="flex-1 overflow-y-auto">
						{loading ? (
							<div className="flex items-center justify-center h-full text-gray-400">
								<div className="animate-spin mr-2">⏳</div> {t('common.loading', 'Loading...')}
							</div>
						) : conversations.length === 0 ? (
							<div className="flex items-center justify-center h-full text-gray-400 text-sm p-4 text-center">
								{t('chat.noConversations', 'No conversations yet. Start chatting with friends!')}
							</div>
						) : (
							conversations.map((conv) => (
								<button
									key={conv.id}
									onClick={() => setSelectedConversation(conv)}
									className={`w-full p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors ${
										selectedConversation?.id === conv.id ? 'bg-gray-800' : ''
									}`}
								>
									<div className="relative">
										{conv.otherUser.avatar ? (
											<img
												src={conv.otherUser.avatar}
												alt=""
												className="w-10 h-10 rounded-full"
											/>
										) : (
											<div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
												{conv.otherUser.username[0].toUpperCase()}
											</div>
										)}
										{conv.otherUser.isOnline && (
											<div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900" />
										)}
									</div>

									<div className="flex-1 min-w-0 text-left">
										<div className="font-medium truncate">{conv.otherUser.username}</div>
										{conv.lastMessage && (
											<div className="text-sm text-gray-400 truncate">
												{conv.lastMessage.content}
											</div>
										)}
									</div>

									{conv.unreadCount > 0 && (
										<div className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
											{conv.unreadCount}
										</div>
									)}
								</button>
							))
						)}
					</div>
				</div>

				{/* Chat Area */}
				<div className="flex-1 flex flex-col">
					{/* Header */}
					<div className="p-4 border-b border-gray-700 flex items-center justify-between">
						{selectedConversation ? (
							<div className="flex items-center gap-3">
								{selectedConversation.otherUser.avatar ? (
									<img
										src={selectedConversation.otherUser.avatar}
										alt=""
										className="w-8 h-8 rounded-full"
									/>
								) : (
									<div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
										{selectedConversation.otherUser.username[0].toUpperCase()}
									</div>
								)}
								<span className="font-medium">{selectedConversation.otherUser.username}</span>
							</div>
						) : (
							<span className="text-gray-400">{t('chat.selectConversation', 'Select a conversation')}</span>
						)}

						<button
							onClick={onClose}
							className="text-gray-400 hover:text-white transition-colors"
						>
							✕
						</button>
					</div>

					{/* Messages */}
					{selectedConversation ? (
						<>
							<div className="flex-1 overflow-y-auto p-4 space-y-3">
								{hasMore && (
									<button
										onClick={loadMore}
										className="w-full py-2 text-sm text-blue-400 hover:text-blue-300"
									>
										{t('chat.loadMore', 'Load earlier messages...')}
									</button>
								)}

								{messages.map((msg) => {
									const isMine = msg.senderId !== selectedConversation.otherUser.id;
									return (
										<div
											key={msg.id}
											className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
										>
											<div
												className={`max-w-[70%] px-3 py-2 rounded-lg ${
													isMine
														? 'bg-blue-600 text-white'
														: 'bg-gray-700 text-white'
												}`}
											>
												<div className="break-words">{msg.content}</div>
												<div
													className={`text-xs mt-1 ${
														isMine ? 'text-blue-200' : 'text-gray-400'
													}`}
												>
													{formatTime(msg.createdAt)}
												</div>
											</div>
										</div>
									);
								})}
								<div ref={messagesEndRef} />
							</div>

							{/* Input */}
							<form onSubmit={handleSend} className="p-4 border-t border-gray-700">
								<div className="flex gap-2">
									<input
										ref={inputRef}
										type="text"
										value={newMessage}
										onChange={(e) => setNewMessage(e.target.value)}
										placeholder={t('chat.placeholder', 'Type a message...')}
										className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
										maxLength={1000}
									/>
									<button
										type="submit"
										disabled={!newMessage.trim() || sending}
										className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
									>
										{sending ? '...' : '➤'}
									</button>
								</div>
							</form>
						</>
					) : (
						<div className="flex-1 flex items-center justify-center text-gray-400">
							{t('chat.selectPrompt', 'Select a conversation to start chatting')}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
