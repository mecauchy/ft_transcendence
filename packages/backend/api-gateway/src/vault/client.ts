// packages/backend/api-gateway/src/vault/client.ts

import Vault from 'node-vault';
import https from 'https';

interface VaultConfig {
	address?: string;
	token?: string;
}

interface IVaultClient {
	init(): Promise<void>;
	getSecret<T = any>(path: string): Promise<T>;
	isHealthy(): Promise<boolean>;
}

export class VaultClient implements IVaultClient {
	private address: string;
	private token?: string;
	private client: any;

	constructor(config: VaultConfig = {}) {
		this.address = config.address || process.env.VAULT_ADDRESS || 'http://vault:8200';
		this.token = config.token || process.env.VAULT_TOKEN;
		
		// Configure TLS settings for self-signed certificates in dev
		const vaultOptions: any = { 
			apiVersion: 'v1', 
			endpoint: this.address 
		};
		
		// Allow self-signed certs in dev, strict in production
		if (process.env.VAULT_SKIP_VERIFY === 'true') {
			vaultOptions.requestOptions = {
				agent: new https.Agent({
					rejectUnauthorized: false
				})
			};
		}
		
		this.client = Vault(vaultOptions);
	}

	async init(): Promise<void> {
		await this.authenticate();
	}

	private async authenticate(): Promise<void> {
		const env = process.env.NODE_ENV || 'development';
		const roleId = process.env.VAULT_ROLE_ID;
		const secretId = process.env.VAULT_SECRET_ID;

		// If we have a direct token, use it (works for both dev and prod)
		if (this.token) {
			this.client.token = this.token;
			return;
		}

		// In production without token, AppRole is required
		if (env === 'production') {
			if (!roleId || !secretId) {
				throw new Error('VAULT_ROLE_ID and VAULT_SECRET_ID must be provided in production (or set VAULT_TOKEN)');
			}
			await this.loginWithAppRole(roleId, secretId);
			return;
		}

		// Development: prefer AppRole if provided, else fallback to VAULT_TOKEN
		if (roleId && secretId) {
			try {
				await this.loginWithAppRole(roleId, secretId);
				return;
			} catch (err) {
				if (this.token) {
					this.client.token = this.token;
					console.warn('AppRole login failed in development, falling back to VAULT_TOKEN');
					return;
				}
				throw err;
			}
		}

		if (this.token) {
			this.client.token = this.token;
			console.log('Using VAULT_TOKEN for Vault authentication');
			return;
		}

		// Last resort in dev: look for mounted secret files (handled by entrypoint normally)
		throw new Error('No Vault authentication available');
	}

	private async loginWithAppRole(roleId: string, secretId: string): Promise<void> {
		const url = `${this.address.replace(/\/$/, '')}/v1/auth/approle/login`;
		
		// Configure fetch options for HTTPS with self-signed certs
		const fetchOptions: any = {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
		};
		
		// Allow self-signed certs in dev
		if (process.env.VAULT_SKIP_VERIFY === 'true') {
			fetchOptions.agent = new https.Agent({
				rejectUnauthorized: false
			});
		}
		
		const res = await fetch(url, fetchOptions);

		if (!res.ok) {
			const body = await res.text().catch(() => '<non-text response>');
			throw new Error(`Vault AppRole login failed (${res.status}): ${body}`);
		}

		const payload: any = await res.json();
		const clientToken = payload?.auth?.client_token;
		if (!clientToken) {
			throw new Error('Vault AppRole login did not return client_token');
		}

		this.token = clientToken;
		this.client.token = clientToken;
	}

	async getSecret<T = any>(path: string): Promise<T> {
		try {
			if (!this.client.token) {
				await this.authenticate();
			}
			const result = await this.client.read(path);
			return result.data as T;
		} catch (error) {
			console.error(`Failed to retrieve secret from path ${path}:`, error);
			throw error;
		}
	}

	async isHealthy(): Promise<boolean> {
		try {
			const health = await this.client.health();
			return health.sealed === false && health.initialized === true;
		} catch (error) {
			console.error('Vault health check failed:', error);
			return false;
		}
	}
}
