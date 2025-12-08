// packages/shared/types/auth.d.ts

export interface IAuthResponse
{
	accessToken: string;
	isTwoFactorEnabled: boolean;
	user: {
		id: number;
		alias: string;
	};
}
