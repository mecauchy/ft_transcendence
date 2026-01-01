// API Client for backend communication
// All requests go through /api/* which is proxied to api-gateway

const API_BASE = '/api';

interface ApiError {
	statusCode:	number;
	error:		string;
	message:	string;
}

interface IPongGame {
	playerid: string;
	mode: "AI" | "LOCAL";
	difficulty: "EASY" | "MEDIUM" | "HARD" | "LOCAL";
	score1: string;
	score2: string;
	winner: "PLAYER" | "AI" | "PLAYER1" | "PLAYER2";
	timestamp1: string;
	timestamp2: string;
}

class ApiClient {
	private token: string | null = null;

	setToken(token: string | null) {
		this.token = token;
	}

	getToken(): string | null {
		return this.token;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
			...options.headers,
		};

		if (this.token) {
			(headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
		}

		const response = await fetch(`${API_BASE}${endpoint}`, {
			...options,
			headers,
			credentials: 'include', // Include cookies for session
		});

		if (!response.ok) {
			const error:		ApiError = await response.json().catch(() => ({
				statusCode:	response.status,
				error:		response.statusText,
				message:	'An error occurred',
			}));
			throw error;
		}

		// Handle 204 No Content
		if (response.status === 204) {
			return {} as T;
		}

		return response.json();
	}

	// Authentification endpoints
	async register(data: {
		username: string;
		email: string;
		password: string;
		dob: string;
	}) {
		return this.request<{userId: string; message:	string}>('/auth/register', {
			method: 'POST',
			body: JSON.stringify(data),
		});
	}

	async login(credentials: {login: string; password: string}) {
		const response = await this.request<{
			accessToken: string;
			refreshToken: string;
			user?: {userId: string; username: string; email: string; role: string};
			require2FA?: boolean;
		}>('/auth/login', {
			method: 'POST',
			body: JSON.stringify(credentials),
		});
		if (!response.require2FA) {
			this.setToken(response.accessToken);
		}
		return response;
	}

	async logout() {
		const result = await this.request<{message:	string}>('/auth/logout', {
			method: 'POST',
		});
		this.setToken(null);
		return result;
	}

	async refreshToken() {
		const response = await this.request<{accessToken: string}>('/auth/refresh', {
			method: 'POST',
		});
		this.setToken(response.accessToken);
		return response;
	}

	// OAuth login
	getOAuthUrl(provider: '42' | 'github') {
		return `${API_BASE}/auth/login/${provider}`;
	}

	// 2FA
	async setup2FA() {
		return this.request<{qrCode: string; secret: string}>('/auth/2fa/setup', {
			method: 'POST',
			body: JSON.stringify({}),
		});
	}

	async verify2FA(code: string) {
		return this.request<{verified: boolean; accessToken?: string}>('/auth/2fa/verify', {
			method: 'POST',
			body: JSON.stringify({code}),
		});
	}

	async disable2FA() {
		return this.request<{success: boolean}>('/auth/2fa/disable', {
			method: 'POST',
		});
	}

	// notifs
	async getNotifications(options?: {limit?: number; offset?: number; unreadOnly?: boolean}) {
		const params = new URLSearchParams();
		if (options?.limit) params.append('limit', options.limit.toString());
		if (options?.offset) params.append('offset', options.offset.toString());
		if (options?.unreadOnly) params.append('unreadOnly', 'true');
		return this.request<{
			notifications: Array<{
				id: string;
				type: string;
				title: string;
				message: string;
				data: Record<string, unknown>;
				isRead: boolean;
				createdAt: string;
			}>;
			total: number;
			unreadCount: number;
			hasMore: boolean;
		}>(`/users/notifications${params.toString() ? '?' + params.toString() : ''}`);
	}

	async getUnreadNotificationCount() {
		return this.request<{unreadCount: number}>('/users/notifications/unread-count');
	}

	async markNotificationRead(notificationId: string) {
		return this.request<{success: boolean}>(`/users/notifications/${notificationId}/read`, {
			method: 'PUT',
		});
	}

	async markAllNotificationsRead() {
		return this.request<{success: boolean; count: number}>('/users/notifications/read-all', {
			method: 'PUT',
		});
	}

	async deleteNotification(notificationId: string) {
		return this.request<{success: boolean}>(`/users/notifications/${notificationId}`, {
			method: 'DELETE',
		});
	}

	async deleteAllNotifications() {
		return this.request<{success: boolean}>('/users/notifications/all', {
			method: 'DELETE',
		});
	}

	// gdpr
	async exportUserData() {
		return this.request<Record<string, unknown>>('/users/gdpr/export');
	}

	async deleteAccount() {
		return this.request<{success: boolean}>('/users/gdpr/delete', {
			method: 'DELETE',
		});
	}

	// match history
	async getPongHistory(options?: {cursor?: string; limit?: number}) {
		const params = new URLSearchParams();
		if (options?.cursor) params.append('cursor', options.cursor);
		if (options?.limit) params.append('limit', options.limit.toString());
		return this.request<{
			matches: Array<{
				id: string;
				playerId: string;
				mode: 'AI' | 'LOCAL';
				difficulty: string;
				score1: number;
				score2: number;
				winner: string;
				startedAt: string;
				endedAt: string;
			}>;
			nextCursor: string | null;
		}>(`/game/pong/history${params.toString() ? '?' + params.toString() : ''}`);
	}

	// user endpoints
	async getProfile(userId?: string) {
		const endpoint = userId ? `/users/${userId}` : '/users/me';
		return this.request<{
			id?: string;
			userId?: string;
			alias?: string;
			username: string;
			email: string;
			displayName?: string;
			avatarUrl?: string;
			level?: number;
			totalXp?: number;
			stressLevel?: number;
			confidenceLevel?: number;
			lastActiveAt?: string;
			createdAt?: string;
			preferences?: {
				language?: 'en' | 'fr' | 'es';
				theme?: 'light' | 'dark';
			};
		}>(endpoint);
	}

	async updateProfile(data: {
		username?: string;
		email?: string;
		displayName?: string;
		stressLevel?: number;
		confidenceLevel?: number;
		preferences?: {
			language?: 'en' | 'fr' | 'es';
			theme?: 'light' | 'dark';
		};
	}) {
		return this.request<{success: boolean; message: string}>('/users/me', {
			method: 'PUT',
			body: JSON.stringify(data),
		});
	}

	async uploadAvatar(file: File) {
		const formData = new FormData();
		formData.append('avatar', file);

		const headers: HeadersInit = {};
		if (this.token) {
			headers['Authorization'] = `Bearer ${this.token}`;
		}

		const response = await fetch(`${API_BASE}/users/me/avatar`, {
			method: 'PUT',
			headers,
			credentials: 'include',
			body: formData,
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({
				statusCode: response.status,
				error: response.statusText,
				message: 'Upload failed',
			}));
			throw error;
		}

		return response.json() as Promise<{url: string; success: boolean}>;
	}

	async getSettings() {
		return this.request<{avatar?: string; colour?: string; locale: string}>(
			'/users/me/settings'
		);
	}

	async updateSettings(settings: {avatar?: string; colour?: string; locale?: string}) {
		return this.request<{message:	string}>('/users/me/settings', {
			method: 'PATCH',
			body: JSON.stringify(settings),
		});
	}

	// Friends
	async getFriends() {
		return this.request<{
			friends: Array<{
				id: string;
				username: string;
				status: 'ONLINE' | 'OFFLINE' | 'IN_SESSION';
			}>;
			pendingRequests: Array<{
				id: string;
				username: string;
				avatarUrl?: string;
				requestedAt: string;
			}>;
			sentRequests: Array<{
				id: string;
				username: string;
				avatarUrl?: string;
				sentAt: string;
			}>;
		}>('/users/friends');
	}

	async sendFriendRequest(targetUsername: string) {
		return this.request<{message: string}>('/users/friends', {
			method: 'POST',
			body: JSON.stringify({targetUsername}),
		});
	}

	async respondToFriendRequest(requesterId: string, accept: boolean) {
		return this.request<{message: string}>(`/users/friends/${requesterId}`, {
			method: 'PUT',
			body: JSON.stringify({action: accept ? 'accept' : 'reject'}),
		});
	}

	async removeFriend(friendId: string) {
		return this.request<{message: string}>(`/users/friends/${friendId}`, {
			method: 'DELETE',
		});
	}

	async blockUser(userId: string) {
		return this.request<{message: string}>(`/users/block/${userId}`, {
			method: 'POST',
		});
	}

	async unblockUser(userId: string) {
		return this.request<{message: string}>(`/users/block/${userId}`, {
			method: 'DELETE',
		});
	}

	// chat endpoints
	async getConversations() {
		return this.request<{
			conversations: Array<{
				id: string;
				otherUser: {id: string; username: string; avatarUrl?: string};
				lastMessage?: {content: string; createdAt: string; isRead: boolean};
				unreadCount: number;
			}>;
		}>('/users/chat/conversations');
	}

	async getConversation(userId: string) {
		return this.request<{
			id: string;
			otherUser: {id: string; username: string; avatarUrl?: string};
		}>(`/users/chat/conversations/${userId}`);
	}

	async getMessages(conversationId: string, cursor?: string) {
		const params = cursor ? `?cursor=${cursor}` : '';
		return this.request<{
			messages: Array<{
				id: string;
				senderId: string;
				content: string;
				isRead: boolean;
				createdAt: string;
			}>;
			nextCursor?: string;
		}>(`/users/chat/messages/${conversationId}${params}`);
	}

	async sendMessage(receiverId: string, content: string) {
		return this.request<{
			messageId: string;
			conversationId: string;
		}>('/users/chat/messages', {
			method: 'POST',
			body: JSON.stringify({receiverId, content}),
		});
	}

	// breathe game history
	async getBreatheHistory(options?: {cursor?: string; limit?: number}) {
		const params = new URLSearchParams();
		if (options?.cursor) params.append('cursor', options.cursor);
		if (options?.limit) params.append('limit', options.limit.toString());
		return this.request<{
			matches: Array<{
				id: string;
				playerId: string;
				startedAt: string;
				endedAt: string;
			}>;
			nextCursor: string | null;
		}>(`/game/breathe/history${params.toString() ? '?' + params.toString() : ''}`);
	}

	// game endpoints
	async sendPong(payload: IPongGame) {
		return this.request<{success: boolean; gameId: string}>('/game/pong/match', {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	}

	async getScenarios() {
		return this.request<{
			scenarios: Array<{
				id: string;
				title: string;
				description: string;
				difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
				estimatedDuration: number;
			}>;
		}>('/game/scenarios');
	}

	async getScenario(scenarioId: string) {
		return this.request<{
			id: string;
			title: string;
			description: string;
			difficulty: string;
			graphData: unknown;
		}>(`/game/scenarios/${scenarioId}`);
	}

	async startSession(data: {scenarioId: string; mode: 'AI' | 'P2P'}) {
		return this.request<{sessionId: string; token: string}>('/game/session/start', {
			method: 'POST',
			body: JSON.stringify(data),
		});
	}

	async getSessionState(sessionId: string) {
		return this.request<{
			sessionId: string;
			status: string;
			metrics: unknown;
		}>(`/game/session/${sessionId}`);
	}

	// Gamification endpoints
	async getLeaderboard(type: 'XP' | 'LEVEL' | 'SESSIONS' = 'XP', limit = 10) {
		return this.request<{
			entries: Array<{
				rank: number;
				userId: string;
				displayName: string;
				score: number;
			}>;
		}>(`/gamification/leaderboard?type=${type}&limit=${limit}`);
	}

	async getPongLeaderboard(limit = 50) {
		return this.request<{
			entries: Array<{
				rank: number;
				playerId: string;
				username: string;
				avatar: string | null;
				games: number;
				wins: number;
				losses: number;
				pointsFor: number;
				pointsAgainst: number;
				durationSeconds: number;
			}>;
		}>(`/game/pong/leaderboard?limit=${limit}`);
	}

	async getAchievements() {
		return this.request<{
			achievements: Array<{
				id: string;
				code: string;
				name: string;
				description: string;
				rarity: string;
				unlockedAt?: string;
			}>;
		}>('/gamification/achievements');
	}

	async getMyStats() {
		return this.request<{
			userId: string;
			totalXp: number;
			level: number;
			sessionsCompleted: number;
			achievementsUnlocked: number;
		}>('/gamification/stats/me');
	}
}

// exporting instance
export const api = new ApiClient();

// error handler export type
export type {ApiError};
