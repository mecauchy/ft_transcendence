import Vault from 'node-vault';

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

	constructor(config: VaultConfig) {
		this.config = config;
		this.client = Vault({
			apiVersion: 'v1',
			endpoint: this.config.address,
		});
	}

	async	authenticate(): Promise<void> {
		try {
			if (this.config.token) {
				this.client.token = this.config.token;
				console.log('Vault authenticated using provided token (development mode).');
				return;
			}

			throw new Error('No authentication method provided for Vault.');
		} catch (error) {
			console.error('Vault authentication failed:', error);
			throw error;
		}
	}

	async	getSecret(path: string): Promise<any> {
		try {
			const result = await this.client.read(path);
			return (result.data);
		} catch (error) {
			if (error instanceof Error) {
				console.error(`Failed to retrieve secret from path ${path} [${error.name}]: ${error.message}`);
			} else {
				console.error(`Failed to retrieve secret from path ${path}:`, error);
			}
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
