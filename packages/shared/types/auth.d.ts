// packages/shared/types/auth.d.ts
import { IUserProfile } from "./user";

export interface IAuthResponse {
	accessToken: string;
	refreshToken: string;
	user: IUserProfile;
	require2FA: boolean;
}

export interface ILoginRequest {
	code: string; // OAuth authorization code from provider
}

export interface I2FAVerifyRequest {
	token: string; // Temporary token received after login indicating 2FA is required
	code: string;  // 2FA code provided by the user TOTP code
}

export interface IRefreshTokenRequest {
	refreshToken: string;
}

export interface ILogoutRequest {
	refreshToken: string;
}
