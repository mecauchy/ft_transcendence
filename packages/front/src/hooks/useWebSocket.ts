import { useEffect, useState, useCallback, useRef } from 'react';
import { wsService } from '../services/websocket';
import type { WebSocketEventType, WebSocketMessage } from '../services/websocket';
import { useAuth } from '../contexts/AuthContext';

interface UseWebSocketOptions {
	autoConnect?: boolean;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: unknown) => void;
}

interface UseWebSocketReturn {
	isConnected: boolean;
	connectionState: 'connecting' | 'connected' | 'disconnected';
	connect: () => Promise<void>;
	disconnect: () => void;
	send: (type: string, data?: unknown) => void;
	subscribe: (eventType: WebSocketEventType, handler: (message: WebSocketMessage) => void) => () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
	const { autoConnect = true, onConnect, onDisconnect, onError } = options;
	const { user } = useAuth();
	const [isConnected, setIsConnected] = useState(false);
	const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
	const subscriptionsRef = useRef<Array<() => void>>([]);

	const connect = useCallback(async () => {
		const token = localStorage.getItem('accessToken');
		if (!token) {
			console.warn('[useWebSocket] No token available');
			return;
		}

		setConnectionState('connecting');

		try {
			await wsService.connect(token);
			setIsConnected(true);
			setConnectionState('connected');
			onConnect?.();
		} catch (error) {
			setIsConnected(false);
			setConnectionState('disconnected');
			onError?.(error);
		}
	}, [onConnect, onError]);

	const disconnect = useCallback(() => {
		wsService.disconnect();
		setIsConnected(false);
		setConnectionState('disconnected');
		onDisconnect?.();
	}, [onDisconnect]);

	const send = useCallback((type: string, data?: unknown) => {
		wsService.send(type, data);
	}, []);

	const subscribe = useCallback((eventType: WebSocketEventType, handler: (message: WebSocketMessage) => void) => {
		const unsubscribe = wsService.on(eventType, handler);
		subscriptionsRef.current.push(unsubscribe);
		return unsubscribe;
	}, []);

	// autoconnect when user is logged in
	useEffect(() => {
		if (autoConnect && user) {
			connect();
		}

		return () => {
			// cleanup for subscriptions
			subscriptionsRef.current.forEach((unsub) => unsub());
			subscriptionsRef.current = [];
		};
	}, [autoConnect, user, connect]);

	// listen for connection state change
	useEffect(() => {
		const handleConnected = () => {
			setIsConnected(true);
			setConnectionState('connected');
		};

		const handleError = (message: WebSocketMessage) => {
			if (message.type === 'ERROR') {
				console.error('[useWebSocket] Error:', message.message);
				onError?.(new Error(message.message));
			}
		};

		const unsubConnect = wsService.on('CONNECTED', handleConnected);
		const unsubError = wsService.on('ERROR', handleError);

		return () => {
			unsubConnect();
			unsubError();
		};
	}, [onError]);

	return {
		isConnected,
		connectionState,
		connect,
		disconnect,
		send,
		subscribe,
	};
}

// hook for notifs
export function useRealtimeNotifications(onNotification?: (notification: unknown) => void) {
	const { subscribe, isConnected } = useWebSocket();

	useEffect(() => {
		if (!isConnected) return;

		const unsubNotification = subscribe('NOTIFICATION', (message) => {
			onNotification?.(message.data);
		});

		const unsubAchievement = subscribe('ACHIEVEMENT_UNLOCKED', (message) => {
			onNotification?.(message.data);
		});

		const unsubLevelUp = subscribe('LEVEL_UP', (message) => {
			onNotification?.(message.data);
		});

		return () => {
			unsubNotification();
			unsubAchievement();
			unsubLevelUp();
		};
	}, [isConnected, subscribe, onNotification]);
}

// hook for presence changes
export function usePresenceUpdates(onPresenceChange?: (userId: string, status: string) => void) {
	const { subscribe, isConnected } = useWebSocket();

	useEffect(() => {
		if (!isConnected) return;

		const unsub = subscribe('PRESENCE_UPDATE', (message) => {
			const data = message.data as { userId: string; status: string };
			if (data) {
				onPresenceChange?.(data.userId, data.status);
			}
		});

		return () => {
			unsub();
		};
	}, [isConnected, subscribe, onPresenceChange]);
}

// hook for friend events
export function useFriendEvents(
	onFriendRequest?: (fromUser: unknown) => void,
	onFriendAccepted?: (friend: unknown) => void
) {
	const { subscribe, isConnected } = useWebSocket();

	useEffect(() => {
		if (!isConnected) return;

		const unsubRequest = subscribe('FRIEND_REQUEST', (message) => {
			onFriendRequest?.(message.data);
		});

		const unsubAccepted = subscribe('FRIEND_ACCEPTED', (message) => {
			onFriendAccepted?.(message.data);
		});

		return () => {
			unsubRequest();
			unsubAccepted();
		};
	}, [isConnected, subscribe, onFriendRequest, onFriendAccepted]);
}

export default useWebSocket;
