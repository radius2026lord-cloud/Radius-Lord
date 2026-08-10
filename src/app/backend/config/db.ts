import mysql from 'mysql2/promise';

import { env } from './env';

let pool: mysql.Pool;

function createPool() {
  const newPool = mysql.createPool({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASS,
    database: env.DB_NAME,
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  console.log('🔌 MySQL pool created');

  // اختبار الاتصال
  newPool
    .getConnection()
    .then((conn) => {
      console.log('✅ Connected to MySQL successfully');
      conn.release();
    })
    .catch((err) => {
      console.error('❌ Initial MySQL connection failed:', err);
    });

  return newPool;
}

// إنشاء الـ pool
pool = createPool();

// إعادة الاتصال عند حدوث مشاكل
async function reconnect() {
  console.log('♻️ Attempting to reconnect to MySQL...');
  try {
    pool = createPool();
    console.log('✅ Reconnected to MySQL');
  } catch (err) {
    console.error('❌ Reconnection failed, retrying in 5 seconds...', err);
    setTimeout(reconnect, 5000);
  }
}

// دالة Query آمنة
async function safeQuery(sql: string, params?: any[]) {
  try {
    return await pool.query(sql, params);
  } catch (err: any) {
    console.error('⚠️ MySQL Query Error:', err.code);

    if (
      err.code === 'PROTOCOL_CONNECTION_LOST' ||
      err.code === 'ECONNRESET' ||
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT'
    ) {
      reconnect();
    }

    throw err;
  }
}

export const db = {
  query: safeQuery,
  pool,
};
