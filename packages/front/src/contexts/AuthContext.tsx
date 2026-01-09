/* eslint-disable react-refresh/only-export-components */
import {createContext, useContext, useState, useEffect, type ReactNode} from 'react';
import {api} from '../api/client';
import type {ApiError} from '../api/client';
import i18n from '../i18n';

interface User {
	userId: string;
	username: string;
	email: string;
	role: string;
	displayName?: string;
	avatarUrl?: string;
	level?: number;
	totalXp?: number;
}

interface AuthContextType {
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (login: string, password: string) => Promise<void>;
	verify2FALogin: (code: string) => Promise<void>;
	register: (username: string, email: string, password: string, dob: string) => Promise<void>;
	logout: () => Promise<void>;
	loginWithOAuth: (provider: '42' | 'github') => void;
	refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: {children: ReactNode}) {
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	// check if session exists
	useEffect(() => {
		const checkAuth = async () => {
			try {
				// skip auth if pending 2FA
				const pending2FA = localStorage.getItem('pending2FAUserId');
				if (pending2FA) {
					console.log('[Auth] Pending 2FA detected, skipping auto-auth');
					setIsLoading(false);
					return;
				}

				// Check if we have a token in localStorage
				const storedToken = localStorage.getItem('accessToken');
				if (!storedToken) {
					// No token = not logged in, this is fine
					setIsLoading(false);
					return;
				}

				api.setToken(storedToken);

				// try get current profile
				const profile = await api.getProfile();
				setUser({
					userId: profile.userId || profile.id || '',
					username: profile.username,
					email: profile.email,
					role: 'PATIENT', // set by default, could be fetched
					displayName: profile.displayName || profile.alias,
					avatarUrl: profile.avatarUrl,
					level: profile.level,
					totalXp: profile.totalXp,
				});
				// Apply user's language preference from profile
				if (profile.preferences?.language && ['en', 'fr', 'es'].includes(profile.preferences.language)) {
					i18n.changeLanguage(profile.preferences.language);
				}
			} catch (error) {
				// Check if this is a 2FA required error
				const apiError = error as { statusCode?: number; require2FA?: boolean; message?: string };
				if (apiError.statusCode === 403 && apiError.require2FA) {
					// Token requires 2FA - don't clear, let user complete 2FA
					console.log('[Auth] 2FA required for this token');
					setIsLoading(false);
					return;
				}
				// For other errors (401, network, etc), clear auth state
				console.error('[Auth] Auth check failed:', error);
				localStorage.removeItem('accessToken');
				setUser(null);
			} finally {
				setIsLoading(false);
			}
		};

		checkAuth();
	}, []);

	const login = async (login: string, password: string) => {
		const response = await api.login({ login, password });

		if (response.require2FA || response.requires2FA) {
			if (response.userId) {
			localStorage.setItem('pending2FAUserId', response.userId);
			}
			throw new Error('2FA_REQUIRED');
		}

		if (response.accessToken) {
			localStorage.setItem('accessToken', response.accessToken);
		}
		// store refresh token for session refresh
		if (response.refreshToken) {
			localStorage.setItem('refreshToken', response.refreshToken);
		}

		if (response.user) {
			setUser({
			...response.user,
			displayName: response.user.username,
			});
		}

		// optional / non-blocking
		try {
			const profile = await api.getProfile();
			if (
			profile.preferences?.language &&
			['en', 'fr', 'es'].includes(profile.preferences.language)
			) {
			i18n.changeLanguage(profile.preferences.language);
			}
		} catch {
			// volontairement ignoré
		}
	};

	const verify2FALogin = async (code: string) => {
		try {
			const userId = localStorage.getItem('pending2FAUserId');
			if (!userId) {
				throw new Error('No 2FA session found');
			}
			
			const response = await api.verify2FALogin(userId, code);
			
			if (response.verified && response.accessToken) {
				localStorage.removeItem('pending2FAUserId');
				localStorage.setItem('accessToken', response.accessToken);
				// store refresh token for session refresh
				if (response.refreshToken) {
					localStorage.setItem('refreshToken', response.refreshToken);
				}
				api.setToken(response.accessToken);
				
				// fetch profile after auth
				const profile = await api.getProfile();
				setUser({
					userId: profile.userId || profile.id || '',
					username: profile.username,
					email: profile.email,
					role: 'PATIENT',
					displayName: profile.displayName || profile.alias,
					avatarUrl: profile.avatarUrl,
					level: profile.level,
					totalXp: profile.totalXp,
				});
				
				if (profile.preferences?.language && ['en', 'fr', 'es'].includes(profile.preferences.language)) {
					i18n.changeLanguage(profile.preferences.language);
				}
			} else {
				throw new Error('2FA verification failed');
			}
		} catch (error) {
			const apiError = error as ApiError;
			throw new Error(apiError.message || '2FA verification failed');
		}
	};

	const register = async (username: string, email: string, password: string, dob: string) => {
		try {
			await api.register({username, email, password, dob});
			// after signup, auto log in
			await login(email, password);
		} catch (error) {
			const apiError = error as ApiError;
			throw new Error(apiError.message || 'Registration failed');
		}
	};

	const logout = async () => {
		try {
			// send refresh token to backend for proper logout
			const refreshToken = localStorage.getItem('refreshToken');
			await api.logout(refreshToken || undefined);
		} catch {
			// clear local state
		}
		localStorage.removeItem('accessToken');
		localStorage.removeItem('refreshToken');
		localStorage.removeItem('pending2FAUserId');
		setUser(null);
	};

	const loginWithOAuth = (provider: '42' | 'github') => {
		// if get oauth, redirect to provider
		window.location.href = api.getOAuthUrl(provider);
	};

	const refreshUser = async () => {
		try {
			const profile = await api.getProfile();
			setUser({
				userId: profile.userId,
				username: profile.username,
				email: profile.email,
				role: 'PATIENT',
				displayName: profile.displayName,
				avatarUrl: profile.avatarUrl,
				level: profile.level,
				totalXp: profile.totalXp,
			});
		} catch {
			// Keep current user if refresh fails
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				isAuthenticated: !!user,
				login,
				verify2FALogin,
				register,
				logout,
				loginWithOAuth,
				refreshUser,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
