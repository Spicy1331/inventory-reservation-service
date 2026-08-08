const app = require('../src/app');
const { initializeDatabase } = require('../src/initDb');

// Trigger database auto-initialization in the background on cold start.
// This is non-blocking so the serverless function responds quickly to requests.
initializeDatabase().catch(err => {
  console.error('❌ Failed to initialize database on serverless function start:', err);
});

module.exports = app;
