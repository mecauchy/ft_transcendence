import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER || 'root_admin',
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME || 'auth_service',
  max: Number(process.env.DB_MAX_CLIENTS ?? 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
  // Enforce TLS in production
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : false,
});

export default pool;

export async function query<T = any>(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return res;
  } finally {
    client.release();
  }
}
