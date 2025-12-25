import { Pool, QueryResultRow } from 'pg';
import { config } from './config';

const pool = new Pool({
	host: config.database.host,
	port: config.database.port,
	user: config.database.user,
	password: config.database.password,
	database: config.database.database,
	max: 10,
	idleTimeoutMillis: 30000,
	ssl: config.database.ssl,
});

export default pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
	text: string,
	params?: unknown[]
) {
	const client = await pool.connect();
	try {
		const res = await client.query<T>(text, params);
		return res;
	} finally {
		client.release();
	}
}
