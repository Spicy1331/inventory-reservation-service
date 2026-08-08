const WebSocket = require('ws');
const db = require('./db');

let wss = null;

const initWebSocket = (server) => {
  // Create WebSocket server attached to the HTTP server
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');

    // Send a welcoming signal
    ws.send(JSON.stringify({ event: 'welcome', message: 'Connected to Inventory Reservation WebSocket Hub' }));

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });

    ws.on('error', (err) => {
      console.error('🔌 WebSocket client error:', err.message);
    });
  });

  console.log('🔌 WebSocket server successfully initialized');
};

const broadcast = (event, data) => {
  if (!wss) {
    return;
  }
  const message = JSON.stringify({ event, data });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
};

/**
 * Helper to fetch the latest stock levels of a product and broadcast to all connected clients
 * @param {string} productId - Product UUID
 */
const broadcastProductUpdate = async (productId) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, description, price, total_stock, available_stock, reserved_stock FROM products WHERE id = ?',
      [productId]
    );
    if (rows.length > 0) {
      console.log(`🔌 Broadcasting stock update for product: ${productId}`);
      broadcast('stock_update', rows[0]);
    }
  } catch (error) {
    console.error(`❌ Failed to broadcast stock update for product ${productId}:`, error.message);
  }
};

module.exports = { initWebSocket, broadcast, broadcastProductUpdate };
