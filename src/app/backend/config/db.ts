import mysql from 'mysql2/promise';

import { env } from './env';

const pool = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  port: env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60_000,
  queueLimit: 100,
  connectTimeout: 10_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

console.log('🔌 MySQL pool created');

// A failed probe must not replace the pool. mysql2's pool discards broken
// connections and creates replacements as subsequent queries need them.
void pool.getConnection()
  .then((connection) => {
    console.log('✅ Connected to MySQL successfully');
    connection.release();
  })
  .catch((error: NodeJS.ErrnoException) => {
    console.error('❌ Initial MySQL connection failed:', {
      code: error.code,
      message: error.message,
    });
  });

const transientConnectionErrors = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
]);

async function safeQuery(sql: string, params?: any[]) {
  try {
    return await pool.query(sql, params);
  } catch (error) {
    const dbError = error as NodeJS.ErrnoException;
    if (dbError.code && transientConnectionErrors.has(dbError.code)) {
      // Do not retry arbitrary SQL: a write may have reached MySQL before the
      // socket reset, so retrying could apply the same change twice.
      console.error('⚠️ MySQL connection interrupted; the next query will use a fresh pooled connection:', {
        code: dbError.code,
        message: dbError.message,
      });
    }
    throw error;
  }
}

export const db = {
  query: safeQuery,
  get pool() {
    return pool;
  },
};
