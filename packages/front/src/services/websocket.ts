// websocket service for realtime
type WebSocketEventType = 
	| 'CONNECTED'
	| 'NOTIFICATION'
	| 'PRESENCE_UPDATE'
	| 'FRIEND_REQUEST'
	| 'FRIEND_ACCEPTED'
	| 'CHAT_MESSAGE'
	| 'MESSAGES_READ'
	| 'TYPING'
	| 'ACHIEVEMENT_UNLOCKED'
	| 'LEVEL_UP'
	| 'ERROR'
	| 'ACK';

interface WebSocketMessage {
	type: WebSocketEventType;
	data?: unknown;
	message?: string;
	timestamp?: number;
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketService {
	private socket: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private messageHandlers: Map<WebSocketEventType, Set<MessageHandler>> = new Map();
	private globalHandlers: Set<MessageHandler> = new Set();
	private connectionPromise: Promise<void> | null = null;
	private isConnecting = false;
	private pingInterval: number | null = null;

	// connect to ws server
	async connect(token: string): Promise<void> {
		if (this.connectionPromise) {
			return this.connectionPromise;
		}

		if (this.socket?.readyState === WebSocket.OPEN) {
			return;
		}

		this.isConnecting = true;

		this.connectionPromise = new Promise((resolve, reject) => {
			try {
				// wss:// for secure and ws:// for dev
				const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
				const host = window.location.host;
				const url = `${protocol}//${host}/api/ws/realtime?token=${encodeURIComponent(token)}`;

				console.log('[WebSocket] Connecting to:', url.replace(token, '***'));

				this.socket = new WebSocket(url);

				this.socket.onopen = () => {
					console.log('[WebSocket] Connected');
					this.reconnectAttempts = 0;
					this.isConnecting = false;
					this.connectionPromise = null;
					this.startPingInterval();
					resolve();
				};

				this.socket.onmessage = (event) => {
					try {
						const message: WebSocketMessage = JSON.parse(event.data);
						this.handleMessage(message);
					} catch (error) {
						console.error('[WebSocket] Failed to parse message:', error);
					}
				};

				this.socket.onclose = (event) => {
					console.log('[WebSocket] Disconnected:', event.code, event.reason);
					this.stopPingInterval();
					this.socket = null;
					this.connectionPromise = null;
					this.isConnecting = false;

					if (event.code !== 1000 && event.code !== 4001) {
						this.attemptReconnect(token);
					}
				};

				this.socket.onerror = (error) => {
					console.error('[WebSocket] Error:', error);
					this.isConnecting = false;
					this.connectionPromise = null;
					reject(error);
				};

			} catch (error) {
				this.isConnecting = false;
				this.connectionPromise = null;
				reject(error);
			}
		});

		return this.connectionPromise;
	}

	// disconnect ws
	disconnect(): void {
		this.stopPingInterval();
		if (this.socket) {
			this.socket.close(1000, 'User disconnected');
			this.socket = null;
		}
		this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
	}

	// send message to server
	send(type: string, data?: unknown): void {
		if (this.socket?.readyState !== WebSocket.OPEN) {
			console.warn('[WebSocket] Cannot send, not connected');
			return;
		}

		this.socket.send(JSON.stringify({ type, data, timestamp: Date.now() }));
	}

	on(eventType: WebSocketEventType, handler: MessageHandler): () => void {
		if (!this.messageHandlers.has(eventType)) {
			this.messageHandlers.set(eventType, new Set());
		}
		this.messageHandlers.get(eventType)!.add(handler);

		return () => {
			this.messageHandlers.get(eventType)?.delete(handler);
		};
	}

	onAny(handler: MessageHandler): () => void {
		this.globalHandlers.add(handler);
		return () => {
			this.globalHandlers.delete(handler);
		};
	}

	// check if connected
	isConnected(): boolean {
		return this.socket?.readyState === WebSocket.OPEN;
	}

	// get connection state
	getState(): 'connecting' | 'connected' | 'disconnected' {
		if (this.isConnecting) return 'connecting';
		if (this.socket?.readyState === WebSocket.OPEN) return 'connected';
		return 'disconnected';
	}

	private handleMessage(message: WebSocketMessage): void {
		// call type handlers
		const handlers = this.messageHandlers.get(message.type);
		if (handlers) {
			handlers.forEach((handler) => handler(message));
		}

		// call global handlers
		this.globalHandlers.forEach((handler) => handler(message));
	}

	private attemptReconnect(token: string): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.log('[WebSocket] Max reconnect attempts reached');
			return;
		}

		this.reconnectAttempts++;
		const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

		console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

		setTimeout(() => {
			this.connect(token).catch((error) => {
				console.error('[WebSocket] Reconnect failed:', error);
			});
		}, delay);
	}

	private startPingInterval(): void {
		// ping 30s for keepalive
		this.pingInterval = window.setInterval(() => {
			this.send('PING');
		}, 30000);
	}

	private stopPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}
}

export const wsService = new WebSocketService();
export type { WebSocketEventType, WebSocketMessage, MessageHandler };
