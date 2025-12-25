import { Pool, QueryResultRow, QueryResult } from 'pg';
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

// Type for transaction query function
type TransactionQueryFn = <R extends QueryResultRow = QueryResultRow>(
	text: string,
	params?: unknown[]
) => Promise<QueryResult<R>>;

// helper for transactions
export async function transaction<T>(
	callback: (queryFn: TransactionQueryFn) => Promise<T>
): Promise<T> {
	const client = await pool.connect();
	
	const transactionQuery: TransactionQueryFn = async <R extends QueryResultRow = QueryResultRow>(
		text: string,
		params?: unknown[]
	) => {
		return client.query<R>(text, params);
	};

	try {
		await client.query('BEGIN');
		const result = await callback(transactionQuery);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}
