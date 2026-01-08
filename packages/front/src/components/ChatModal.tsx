import {useEffect, useRef, useState, useCallback} from 'react';
import {api} from '../api/client';
import {useTranslation} from 'react-i18next';
import {wsService} from '../services/websocket';

// click on user to view profile
const navigateToProfile = (userId: string, onClose: () => void) => {
	onClose();
	window.history.pushState({page: 'profile', userId}, '', `/profile/${userId}`);
	window.dispatchEvent(new PopStateEvent('popstate', {state: {page: 'profile', userId}}));
};

type Conversation = {
	id: string;
	otherUser: {
		id: string;
		username: string;
		avatarUrl?: string;
		isOnline?: boolean;
	};
	lastMessage?: {
		content: string;
		createdAt: string;
		isRead?: boolean;
	};
	unreadCount: number;
};

type Message = {
	id: string;
	senderId: string;
	content: string;
	isRead: boolean;
	createdAt: string;
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
	const [isTyping, setIsTyping] = useState(false);
	const [otherUserTyping, setOtherUserTyping] = useState(false);
	const [sendError, setSendError] = useState<string | null>(null);
	const [showMobileChat, setShowMobileChat] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// typing indicator
	const sendTypingIndicator = useCallback(() => {
		if (selectedConversation && selectedConversation.id !== 'new') {
			wsService.send('TYPING', {
				conversationId: selectedConversation.id,
				recipientId: selectedConversation.otherUser.id,
			});
		}
	}, [selectedConversation]);

	// typing indicator on input change
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setNewMessage(e.target.value);
		
		// send typing indicator if istyping
		if (!isTyping) {
			setIsTyping(true);
			sendTypingIndicator();
		}

		// clear typing timeout on update
		if (typingTimeoutRef.current) {
			clearTimeout(typingTimeoutRef.current);
		}

		// set timeout to not show infinitely
		typingTimeoutRef.current = setTimeout(() => {
			setIsTyping(false);
		}, 2000);
	};

	// listen for typing indicators from other users
	useEffect(() => {
		if (!selectedConversation || selectedConversation.id === 'new') return;

		const unsubscribe = wsService.on('TYPING', (message) => {
			console.log('[Chat] Received TYPING event:', message);
			const data = message.data as { conversationId: string; userId: string };
			if (data && data.conversationId === selectedConversation.id && 
				data.userId === selectedConversation.otherUser.id) {
				console.log('[Chat] Setting typing indicator for user:', data.userId);
				setOtherUserTyping(true);
				setTimeout(() => setOtherUserTyping(false), 3000);
			}
		});

		return () => {
			unsubscribe();
		};
	}, [selectedConversation]);

	// listen for read status updates
	useEffect(() => {
		const unsubscribe = wsService.on('MESSAGES_READ', (message) => {
			const data = message.data as {
				conversationId: string;
				readByUserId: string;
			};

			// if convo is active, automark as read
			if (selectedConversation && selectedConversation.id === data.conversationId) {
				setMessages((prev) =>
					prev.map((msg) =>
						msg.senderId !== data.readByUserId ? { ...msg, isRead: true } : msg
					)
				);
			}

			// update convo list
			setConversations((prev) =>
				prev.map((c) =>
					c.id === data.conversationId && c.lastMessage
						? {
								...c,
								lastMessage: {
									...c.lastMessage,
									isRead: true,
								},
								unreadCount: 0,
						  }
						: c
				)
			);
		});

		return () => {
			unsubscribe();
		};
	}, [selectedConversation]);

	// listen with websockket
	useEffect(() => {
		const unsubscribe = wsService.on('CHAT_MESSAGE', (message) => {
			const data = message.data as {
				messageId: string;
				senderId: string;
				senderUsername?: string;
				senderAvatarUrl?: string;
				content: string;
				conversationId: string;
				createdAt: string;
			};

			// if conversation is selected and new message is in that convo, update list
			// modal open check
			const isConversationActive = selectedConversation && isOpen && 
				(window.innerWidth >= 768 || showMobileChat);
			
			if (isConversationActive &&
				(selectedConversation.id === data.conversationId || 
				 selectedConversation.otherUser.id === data.senderId)) {
				// if message isnt from us, add to chatlog
				const newMsg: Message = {
					id: data.messageId,
					senderId: data.senderId,
					content: data.content,
					isRead: false,
					createdAt: data.createdAt,
				};
				setMessages((prev) => {
					// duplicate fix
					if (prev.some((m) => m.id === data.messageId)) return prev;
					return [...prev, newMsg];
				});

				// if convo active automark as read
				if (selectedConversation.id === data.conversationId && 
					data.senderId === selectedConversation.otherUser.id) {
					// call api to update status
					api.getMessages(data.conversationId, undefined).catch((err) => {
						console.error('Failed to mark messages as read:', err);
					});
				}
			}

			// update convo list with latest interaction
			setConversations((prev) =>
				prev.map((c) =>
					c.id === data.conversationId || c.otherUser.id === data.senderId
						? {
								...c,
								lastMessage: {
									content: data.content,
									createdAt: data.createdAt,
									isRead: selectedConversation?.id === data.conversationId,
								},
								unreadCount: selectedConversation?.id === data.conversationId 
									? c.unreadCount 
									: c.unreadCount + 1,
						  }
						: c
				)
			);
		});

		return () => {
			unsubscribe();
		};
	}, [selectedConversation, isOpen, showMobileChat]);

	// cleanup when modal closes
	useEffect(() => {
		if (!isOpen) {
			setMessages([]);
			setShowMobileChat(false);
		}
	}, [isOpen]);

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
						setShowMobileChat(true); // Show chat on mobile when opening with user
					} else {
						// fetch user profile to get avatar
						try {
							const userProfile = await api.getProfile(initialUserId);
							setSelectedConversation({
								id: 'new',
								otherUser: {
									id: initialUserId,
									username: userProfile.username || 'User',
									avatarUrl: userProfile.avatarUrl,
								},
								unreadCount: 0,
							});
							setMessages([]);
							setCursor(null);
							setHasMore(false);
							setShowMobileChat(true);
						} catch {
							setSelectedConversation({
								id: 'new',
								otherUser: {
									id: initialUserId,
									username: 'User',
								},
								unreadCount: 0,
							});
							setShowMobileChat(true);
						}
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
			// COMMENTED FOR NOW FOR ESLINT
			// setMessages([]);
			return;
		}

		const loadMessages = async () => {
			try {
				const res = await api.getMessages(selectedConversation.id);
				// reverse messages when loading them
				setMessages((res.messages || []).reverse());
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
			// reverse messages from load more
			setMessages((prev) => [...(res.messages || []).reverse(), ...prev]);
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
		setSendError(null);
		try {
			const res = await api.sendMessage(selectedConversation.otherUser.id, newMessage.trim());

			// add msg to list
			const newMsg: Message = {
				id: res.messageId,
				senderId: 'me',
				content: newMessage.trim(),
				isRead: false,
				createdAt: new Date().toISOString(),
			};
			setMessages((prev) => [...prev, newMsg]);
			setNewMessage('');

			// update conversation
			setConversations((prev) =>
				prev.map((c) =>
					c.id === selectedConversation.id || c.otherUser.id === selectedConversation.otherUser.id
						? {
								...c,
								id: res.conversationId || c.id,
								lastMessage: {
									content: newMessage.trim(),
									createdAt: new Date().toISOString(),
								},
						  }
						: c
				)
			);

			// if newconvo, update id
			if (selectedConversation.id === 'new') {
				setSelectedConversation((prev) =>
					prev ? {...prev, id: res.conversationId} : prev
				);
			}
		} catch (e: unknown) {
			console.error('Failed to send message:', e);
			const error = e as { statusCode?: number; message?: string };
			if (error.statusCode === 403) {
				setSendError(t('chat.cannotMessage', 'Cannot send message to this user'));
			} else if (error.statusCode === 404) {
				setSendError(t('chat.userNotFound', 'User not found'));
			} else {
				setSendError(t('chat.sendFailed', 'Failed to send message'));
			}
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

	const handleSelectConversation = (conv: Conversation) => {
		// always reset messages
		setMessages([]);
		setCursor(null);
		setHasMore(false);
		setSelectedConversation(conv);
		setShowMobileChat(true);
	};

	const handleMobileBack = () => {
		setShowMobileChat(false);
	};

	return (
		<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 md:p-4 pt-20 md:pt-4">
			<div className="bg-gray-900 rounded-lg w-full max-w-4xl h-[calc(100vh-6rem)] md:h-[600px] max-h-[85vh] md:max-h-[600px] flex overflow-hidden">
				{/* Conversation List */}
				<div className={`w-full md:w-80 border-r border-gray-700 flex flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
					<div className="p-4 border-b border-gray-700 flex items-center justify-between">
						<h2 className="text-lg font-semibold">{t('chat.title', 'Messages')}</h2>
						<button
							onClick={onClose}
							className="text-gray-400 hover:text-white transition-colors md:hidden"
						>
							✕
						</button>
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
									onClick={() => handleSelectConversation(conv)}
									className={`w-full p-3 flex items-center gap-3 hover:bg-gray-800 transition-colors ${
										selectedConversation?.id === conv.id ? 'bg-gray-800' : ''
									}`}
								>
									<div
										className="relative cursor-pointer"
										onClick={(e) => {
											e.stopPropagation();
											navigateToProfile(conv.otherUser.id, onClose);
										}}
										title={t('chat.viewProfile', 'View profile')}
									>
										{conv.otherUser.avatarUrl ? (
											<img
												src={conv.otherUser.avatarUrl}
												alt=""
												className="w-10 h-10 rounded-full hover:ring-2 hover:ring-blue-500 transition-all"
											/>
										) : (
											<div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold hover:ring-2 hover:ring-blue-500 transition-all">
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
				<div className={`flex-1 flex flex-col ${showMobileChat ? 'flex' : 'hidden md:flex'}`}>
					{/* Header */}
					<div className="p-4 border-b border-gray-700 flex items-center justify-between">
						{selectedConversation ? (
							<div className="flex items-center gap-3">
								{/* Mobile back button */}
								<button
									onClick={handleMobileBack}
									className="text-gray-400 hover:text-white transition-colors md:hidden mr-2"
								>
									←
								</button>
								<div
									className="cursor-pointer"
									onClick={() => navigateToProfile(selectedConversation.otherUser.id, onClose)}
									title={t('chat.viewProfile', 'View profile')}
								>
									{selectedConversation.otherUser.avatarUrl ? (
										<img
											src={selectedConversation.otherUser.avatarUrl}
											alt=""
											className="w-8 h-8 rounded-full hover:ring-2 hover:ring-blue-500 transition-all"
										/>
									) : (
										<div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm hover:ring-2 hover:ring-blue-500 transition-all">
											{selectedConversation.otherUser.username[0].toUpperCase()}
										</div>
									)}
								</div>
								<span
									className="font-medium cursor-pointer hover:text-blue-400 transition-colors"
									onClick={() => navigateToProfile(selectedConversation.otherUser.id, onClose)}
								>
									{selectedConversation.otherUser.username}
								</span>
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

								{messages.map((msg, index) => {
									const isMine = msg.senderId !== selectedConversation.otherUser.id;
									// read tick
									const isLastReadMessage = isMine && msg.isRead && 
										!messages.slice(index + 1).some(m => 
											m.senderId !== selectedConversation.otherUser.id && m.isRead
										);
									return (
										<div
											key={msg.id}
											className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
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
											{isLastReadMessage && (
												<span className="text-xs text-gray-400 mt-1 mr-1">
													{t('chat.read', 'Read')} ✓
												</span>
											)}
										</div>
									);
								})}
								<div ref={messagesEndRef} />

								{/* Typing indicator */}
								{otherUserTyping && (
									<div className="flex justify-start">
										<div className="bg-gray-700 px-4 py-3 rounded-lg flex items-center gap-1">
											<span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
											<span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
											<span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
										</div>
									</div>
								)}
							</div>

							{/* Input */}
							<form onSubmit={handleSend} className="p-4 border-t border-gray-700">
								{sendError && (
									<div className="mb-2 px-3 py-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
										{sendError}
									</div>
								)}
								<div className="flex gap-2">
									<input
										ref={inputRef}
										type="text"
										value={newMessage}
										onChange={handleInputChange}
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
