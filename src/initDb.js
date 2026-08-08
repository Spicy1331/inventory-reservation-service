const fs = require('fs');
const path = require('path');
const pool = require('./db');

let dbInitPromise = null;

async function initializeDatabase() {
  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = (async () => {
    try {
      console.log('🔄 Checking database initialization...');
      const sqlPath = path.join(__dirname, '..', 'db', 'setup.sql');
      if (!fs.existsSync(sqlPath)) {
        console.warn(`⚠️ SQL setup file not found at: ${sqlPath}. Skipping auto-initialization.`);
        return;
      }
      
      const sql = fs.readFileSync(sqlPath, 'utf8');

      // Remove comments and split by semicolon
      const cleanedSql = sql
        .split('\n')
        .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('#'))
        .join('\n');

      const statements = cleanedSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => {
          if (!stmt) return false;
          const lower = stmt.toLowerCase();
          // Skip database creation/use commands to prevent permission issues on cloud managed DBs
          if (lower.startsWith('create database') || lower.startsWith('use ')) {
            return false;
          }
          return true;
        });

      const conn = await pool.getConnection();
      try {
        for (const statement of statements) {
          await conn.query(statement);
        }
        console.log('✅ Database schema initialized/verified successfully');
      } finally {
        conn.release();
      }
    } catch (error) {
      console.error('❌ Failed to initialize database schema:', error.message);
      // We don't rethrow to avoid blocking server start (if DB schema was already loaded manually)
    }
  })();

  return dbInitPromise;
}

module.exports = { initializeDatabase };
