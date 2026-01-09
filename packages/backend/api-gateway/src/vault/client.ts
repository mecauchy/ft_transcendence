import Vault from 'node-vault';
import https from 'https';

// interface for the vault config
interface	VaultConfig {
	address:	string;
	token?:		string;
}

// minimal interface for the vault client
interface	IVaultClient {
	read(path: string):	Promise<{data: any}>;
	health():			Promise<{sealed: boolean; initialized: boolean}>;
	token?:				string;
}

export class	VaultClient {
	private client:	IVaultClient;
	private config:	VaultConfig;
	private token?:	string;

	constructor(config: VaultConfig) {
		this.config = config;
		this.token = config.token;
		this.client = Vault({
			apiVersion: 'v1',
			endpoint: this.config.address,
		});
	}

	async	init(): Promise<void> {
		await this.authenticate();
	}

	async	authenticate(): Promise<void> {
		try {
			if (this.config.token) {
				this.client.token = this.config.token;
				console.log('Vault authenticated using provided token (development mode).');
				return;
			}

			if (this.token) {
				this.client.token = this.token;
				console.log('Using VAULT_TOKEN for Vault authentication');
				return;
			}

			// Last resort in dev: look for mounted secret files (handled by entrypoint normally)
			throw new Error('No Vault authentication available');
		} catch (err) {
			if (this.token) {
				this.client.token = this.token;
				console.warn('Vault login failed, falling back to VAULT_TOKEN');
				return;
			}
			throw err;
		}
	}

	private async loginWithAppRole(roleId: string, secretId: string): Promise<void> {
		const url = `${this.config.address.replace(/\/$/, '')}/v1/auth/approle/login`;
		
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

	async	getSecret(path: string): Promise<any> {
		try {
			if (!this.client.token) {
				await this.authenticate();
			}
			const result = await this.client.read(path);
			return (result.data);
		} catch (error) {
			console.error(`Failed to retrieve secret from path ${path}:`, error);
			throw error;
		}
	}

	async	isHealthy(): Promise<boolean> {
		try {
			const health = await this.client.health();
			return (health.sealed === false && health.initialized === true);
		} catch (error) {
			console.error('Vault health check failed:', error);
			return (false);
		}
	}
}
