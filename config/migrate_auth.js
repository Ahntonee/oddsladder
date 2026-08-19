require('dotenv').config();
const { pool } = require('./db');

async function migrateAuth() {
  const db = pool;

  await db.query(`
    CREATE TABLE IF NOT EXISTS pending_registrations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      country VARCHAR(100),
      token VARCHAR(6) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('[MigrateAuth] pending_registrations table ready');
  process.exitCode = 0;
}

migrateAuth().then(() => {
  console.log('[MigrateAuth] Done');
  process.exit(0);
}).catch(err => {
  console.error('[MigrateAuth] Error:', err.message);
  process.exit(1);
});
