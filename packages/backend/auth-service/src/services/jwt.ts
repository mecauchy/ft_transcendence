import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import { config } from '../config';
import Redis from 'ioredis';

// config redis for tokens
const redis = new Redis({
	host: config.redis.host,
	port: config.redis.port,
	retryStrategy: (times) => Math.min(times * 50, 2000),
});

export interface TokenPayload {
	userId: string;
	role: string;
	requires2FA?: boolean;
}

interface GeneratedTokens {
	accessToken: string;
	refreshToken: string;
}

// generate access + refresh tokens
export async function generateTokens(payload: TokenPayload): Promise<GeneratedTokens> {
	const accessTokenOptions: SignOptions = {
		expiresIn: config.jwt.accessTokenExpiry,
		issuer: config.jwt.issuer,
		subject: payload.userId,
	};

	const refreshTokenOptions: SignOptions = {
		expiresIn: config.jwt.refreshTokenExpiry,
		issuer: config.jwt.issuer,
		subject: payload.userId,
	};

	const accessTokenPayload = {
		userId: payload.userId,
		role: payload.role,
		requires2FA: payload.requires2FA || false,
		type: 'access',
	};

	const refreshTokenPayload = {
		userId: payload.userId,
		role: payload.role,
		type: 'refresh',
	};

	const accessToken = jwt.sign(accessTokenPayload, config.jwt.secret, accessTokenOptions);
	const refreshToken = jwt.sign(refreshTokenPayload, config.jwt.secret, refreshTokenOptions);

	return { accessToken, refreshToken };
}

// verify a token
export async function verifyAccessToken(token: string): Promise<TokenPayload> {
	const decoded = jwt.verify(token, config.jwt.secret, {
		issuer: config.jwt.issuer,
	}) as JwtPayload & TokenPayload & { type: string };

	if (decoded.type !== 'access') {
		throw new Error('Invalid token type');
	}

	// check if blacklisted
	const isBlacklisted = await redis.get(`blacklist:${token}`);
	if (isBlacklisted) {
		throw new Error('Token has been revoked');
	}

	return {
		userId: decoded.userId,
		role: decoded.role,
		requires2FA: decoded.requires2FA,
	};
}

// verify a refresh token
export async function verifyRefreshToken(token: string): Promise<TokenPayload> {
	const decoded = jwt.verify(token, config.jwt.secret, {
		issuer: config.jwt.issuer,
	}) as JwtPayload & TokenPayload & { type: string };

	if (decoded.type !== 'refresh') {
		throw new Error('Invalid token type');
	}

	// check if blacklisted
	const isBlacklisted = await redis.get(`blacklist:${token}`);
	if (isBlacklisted) {
		throw new Error('Token has been revoked');
	}

	return {
		userId: decoded.userId,
		role: decoded.role,
	};
}

// blacklist a token
export async function blacklistToken(token: string): Promise<void> {
	try {
		// decode
		const decoded = jwt.decode(token) as JwtPayload;

		if (decoded?.timeExp) {
			// set blacklist entry with TTL matching token expiry
			const ttl = decoded.timeExp - Math.floor(Date.now() / 1000);
			if (ttl > 0) {
				await redis.setex(`blacklist:${token}`, ttl, '1');
			}
		} else {
			// else blacklist for 7 days
			await redis.setex(`blacklist:${token}`, 7 * 24 * 60 * 60, '1');
		}
	} catch (error) {
		console.error('Failed to blacklist token:', error);
	}
}

// fetch userid from token
export function extractUserId(token: string): string | null {
	try {
		const decoded = jwt.decode(token) as JwtPayload & TokenPayload;
		return decoded?.userId || null;
	} catch {
		return null;
	}
}
