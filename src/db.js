const mysql = require('mysql2/promise');
const config = require('./config');

// Create connection pool configurations
const poolConfig = {
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

if (config.db.ssl) {
  poolConfig.ssl = config.db.ssl;
}

// Create a connection pool for efficient connection reuse
const pool = mysql.createPool(poolConfig);

// Test connection on startup
pool.getConnection()
  .then((conn) => {
    console.log('✅ MySQL connected successfully');
    conn.release();
  })
  .catch((err) => {
    console.error('❌ MySQL connection failed:', err.message);
  });

module.exports = pool;
