const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');

const expireReservations = async () => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Find all expired pending reservations and lock them
    const [expiredReservations] = await conn.query(
      "SELECT * FROM reservations WHERE status = 'pending' AND expires_at < NOW() FOR UPDATE"
    );

    if (expiredReservations.length === 0) {
      await conn.commit();
      conn.release();
      return;
    }

    console.log(`⏱️  Found ${expiredReservations.length} expired reservation(s). Processing...`);

    for (const reservation of expiredReservations) {
      // Lock the product row
      const [products] = await conn.query(
        'SELECT * FROM products WHERE id = ? FOR UPDATE',
        [reservation.product_id]
      );

      if (products.length === 0) continue;

      const product = products[0];

      // Release reserved stock back to available
      await conn.query(
        'UPDATE products SET available_stock = available_stock + ?, reserved_stock = reserved_stock - ? WHERE id = ?',
        [reservation.quantity, reservation.quantity, reservation.product_id]
      );

      // Mark reservation as expired
      await conn.query(
        "UPDATE reservations SET status = 'expired', updated_at = NOW() WHERE id = ?",
        [reservation.id]
      );

      // Audit log
      await conn.query(
        `INSERT INTO inventory_audit_log (id, product_id, reservation_id, action, quantity_changed, stock_before, stock_after, reason)
         VALUES (?, ?, ?, 'released', ?, ?, ?, 'Reservation expired - automatic release')`,
        [
          uuidv4(),
          reservation.product_id,
          reservation.id,
          reservation.quantity,
          product.available_stock,
          product.available_stock + reservation.quantity,
        ]
      );

      console.log(`  ✅ Expired reservation ${reservation.id}: released ${reservation.quantity} units of product ${reservation.product_id}`);
    }

    await conn.commit();

    // Broadcast stock updates for all affected products via WebSockets
    const { broadcastProductUpdate } = require('../websocket');
    const uniqueProductIds = [...new Set(expiredReservations.map(r => r.product_id))];
    for (const productId of uniqueProductIds) {
      broadcastProductUpdate(productId);
    }

    console.log(`⏱️  Expiry sweep complete. Processed ${expiredReservations.length} reservation(s).`);
  } catch (error) {
    await conn.rollback();
    console.error('❌ Expiry worker error:', error.message);
  } finally {
    conn.release();
  }
};

const startExpiryWorker = () => {
  const cronExpression = config.expiryCronInterval;

  cron.schedule(cronExpression, async () => {
    await expireReservations();
  });

  console.log(`⏱️  Expiry worker scheduled with cron: ${cronExpression}`);
};

module.exports = { startExpiryWorker, expireReservations };
