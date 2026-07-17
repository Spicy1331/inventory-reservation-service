require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // MySQL
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory_reservation',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_me',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },

  // Reservation
  reservationTTLMinutes: parseInt(process.env.RESERVATION_TTL_MINUTES) || 10,

  // Cron
  expiryCronInterval: process.env.EXPIRY_CRON_INTERVAL || '*/30 * * * * *',
};

module.exports = config;
