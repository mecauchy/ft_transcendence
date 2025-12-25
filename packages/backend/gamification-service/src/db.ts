import pg from 'pg';
import { config } from './config';

const { Pool } = pg;

const pool = new Pool({
	host: config.database.host,
	port: config.database.port,
	user: config.database.user,
	password: config.database.password,
	database: config.database.database,
	ssl: config.database.ssl,
	max: 20,
	idleTimeoutMillis: 30000,
	connectionTimeoutMillis: 2000,
});

pool.on('error', (err: Error) => {
	console.error('Unexpected database error:', err);
});

export async function query(text: string, params?: unknown[]): Promise<pg.QueryResult> {
	const start = Date.now();
	const result = await pool.query(text, params);
	const duration = Date.now() - start;
	
	if (duration > 100) {
		console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
	}
	
	return result;
}

export async function getClient(): Promise<pg.PoolClient> {
	return pool.connect();
}

export async function closePool(): Promise<void> {
	await pool.end();
}
