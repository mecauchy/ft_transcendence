// packages/shared/types/user.ts

export enum UserRole {
	PATIENT = 'PATIENT',
	DOCTOR = 'DOCTOR',
	ADMIN = 'ADMIN'
}

export interface IUserProfile {
	id:	string;
	username: string;
	email:	string;
	avatarUrl: string;
	role: UserRole;
	preferences: {
		language: 'fr' | 'en';
		theme: 'light' | 'dark';
		accessibility: {
			highContrast: boolean;
			textToSpeech: boolean;
			fontSize: 'small' | 'medium' | 'large';
		};
	};
	stats: {
		sessionsCompleted: number;
		averageTrustScore: number;
	};
}

export interface IFriend {
	id:	string;
	username: string;
	status: 'ONLINE' | 'OFFLINE' | 'IN_SESSION';
	lastSeen: number;
}
