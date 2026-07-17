const app = require('./app');
const config = require('./config');
const { startExpiryWorker } = require('./jobs/expiryWorker');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${config.nodeEnv}`);
  console.log(`⏱️  Reservation TTL: ${config.reservationTTLMinutes} minutes`);

  // Start the background job for expiring reservations
  startExpiryWorker();
  console.log('🔄 Reservation expiry worker started');
});
