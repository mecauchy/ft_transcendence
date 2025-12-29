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
			} catch {
				// no auth
				setUser(null);
			} finally {
				setIsLoading(false);
			}
		};

		checkAuth();
	}, []);

	const login = async (login: string, password: string) => {
		try {
			const response = await api.login({login, password});
			setUser({
				...response.user,
				displayName: response.user.username,
			});
			// Fetch profile to get language preference after login
			try {
				const profile = await api.getProfile();
				if (profile.preferences?.language && ['en', 'fr', 'es'].includes(profile.preferences.language)) {
					i18n.changeLanguage(profile.preferences.language);
				}
			} catch {
				// Ignore if profile fetch fails
			}
		} catch (error) {
			const apiError = error as ApiError;
			throw new Error(apiError.message || 'Login failed');
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
			await api.logout();
		} catch {
			// clear local state
		}
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
