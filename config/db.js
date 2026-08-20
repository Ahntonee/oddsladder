require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'predictvilla',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function connectWithRetry(attempts = 5, delay = 3000) {
  for (let i = 1; i <= attempts; i++) {
    try {
      const conn = await pool.getConnection();
      conn.release();
      console.log('[DB] MySQL connected successfully');
      return;
    } catch (err) {
      console.error(`[DB] Connection attempt ${i}/${attempts} failed: ${err.message}`);
      if (i < attempts) await new Promise(r => setTimeout(r, delay));
      else throw new Error('[DB] Could not connect to MySQL after multiple attempts');
    }
  }
}

module.exports = { pool, connectWithRetry };
