const app = require('./app');
const config = require('./config');
const { startExpiryWorker } = require('./jobs/expiryWorker');
const { initializeDatabase } = require('./initDb');

const PORT = config.port;

async function start() {
  // Ensure database tables are created before accepting traffic
  await initializeDatabase();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Environment: ${config.nodeEnv}`);
    console.log(`⏱️  Reservation TTL: ${config.reservationTTLMinutes} minutes`);

    // Start the background job for expiring reservations
    startExpiryWorker();
    console.log('🔄 Reservation expiry worker started');
  });

  // Attach WebSocket server to the HTTP server
  const { initWebSocket } = require('./websocket');
  initWebSocket(server);
}

start().catch(err => {
  console.error('❌ Server startup failure:', err);
});
