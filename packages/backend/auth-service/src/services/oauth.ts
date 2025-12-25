import { config } from '../config';

interface OAuth42TokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token: string;
	scope: string;
	created_at: number;
}

interface OAuth42UserInfo {
	id: number;
	email: string;
	login: string;
	first_name: string;
	last_name: string;
	usual_full_name: string;
	usual_first_name: string | null;
	url: string;
	phone: string;
	displayname: string;
	kind: string;
	image: {
		link: string;
		versions: {
			large: string;
			medium: string;
			small: string;
			micro: string;
		};
	};
	staff?: boolean;
	correction_point: number;
	pool_month: string;
	pool_year: string;
	location: string | null;
	wallet: number;
	anonymize_date: string;
	data_erasure_date: string | null;
	created_at: string;
	updated_at: string;
	alumni?: boolean;
	active?: boolean;
}

// exchange oauth for tokens
export async function fetchOAuthToken(code: string): Promise<OAuth42TokenResponse> {
	const response = await fetch(config.oauth.tokenUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: config.oauth.clientId,
			client_secret: config.oauth.clientSecret,
			code,
			redirect_uri: config.oauth.redirectUri,
		}).toString(),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('OAuth token exchange failed:', response.status, errorText);
		throw new Error(`OAuth token exchange failed: ${response.status}`);
	}

	const data = await response.json() as OAuth42TokenResponse;
	return data;
}

// fetch user info from 42api
export async function fetch42UserInfo(accessToken: string): Promise<OAuth42UserInfo> {
	const response = await fetch(config.oauth.userInfoUrl, {
		headers: {
			'Authorization': `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('Failed to fetch 42 user info:', response.status, errorText);
		throw new Error(`Failed to fetch user info: ${response.status}`);
	}

	const data = await response.json() as OAuth42UserInfo;
	return data;
}

// refresh oauth token on need
export async function refreshOAuthToken(refreshToken: string): Promise<OAuth42TokenResponse> {
	const response = await fetch(config.oauth.tokenUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: new URLSearchParams({
			grant_type: 'refresh_token',
			client_id: config.oauth.clientId,
			client_secret: config.oauth.clientSecret,
			refresh_token: refreshToken,
		}).toString(),
	});

	if (!response.ok) {
		const errorText = await response.text();
		console.error('OAuth token refresh failed:', response.status, errorText);
		throw new Error(`OAuth token refresh failed: ${response.status}`);
	}

	const data = await response.json() as OAuth42TokenResponse;
	return data;
}
