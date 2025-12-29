// API Client for backend communication
// All requests go through /api/* which is proxied to api-gateway

const API_BASE = '/api';

interface ApiError {
	statusCode:	number;
	error:		string;
	message:	string;
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
			user: {userId: string; username: string; email: string; role: string};
		}>('/auth/login', {
			method: 'POST',
			body: JSON.stringify(credentials),
		});
		this.setToken(response.accessToken);
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
		return `${API_BASE}/auth/oauth/${provider}`;
	}

	// 2FA
	async enable2FA() {
		return this.request<{qrCode: string; secret: string}>('/auth/2fa/enable', {
			method: 'POST',
		});
	}

	async verify2FA(code: string) {
		return this.request<{verified: boolean}>('/auth/2fa/verify', {
			method: 'POST',
			body: JSON.stringify({code}),
		});
	}

	// User endpoints
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

	// Game endpoints
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
