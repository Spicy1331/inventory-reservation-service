const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// POST /api/payments/confirm
const confirmPayment = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { reservation_id, payment_id } = req.body;
    const userId = req.user.id;

    // ===== Idempotency: Check if this payment_id was already processed =====
    const [existingOrder] = await conn.query(
      'SELECT * FROM orders WHERE payment_id = ?',
      [payment_id]
    );

    if (existingOrder.length > 0) {
      conn.release();
      console.log(`ℹ️  Duplicate payment notification (payment_id: ${payment_id})`);
      return res.status(200).json({
        success: true,
        message: 'Payment was already processed (idempotent response)',
        data: { order: existingOrder[0] },
      });
    }

    await conn.beginTransaction();

    // Lock the reservation
    const [reservations] = await conn.query(
      'SELECT * FROM reservations WHERE id = ? AND user_id = ? FOR UPDATE',
      [reservation_id, userId]
    );

    if (reservations.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reservation not found' },
      });
    }

    const reservation = reservations[0];

    // Can only confirm pending reservations
    if (reservation.status !== 'pending') {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot confirm payment for reservation with status '${reservation.status}'`,
        },
      });
    }

    // Check if reservation has expired
    if (new Date(reservation.expires_at) < new Date()) {
      await conn.rollback();
      conn.release();
      return res.status(410).json({
        success: false,
        error: {
          code: 'RESERVATION_EXPIRED',
          message: 'This reservation has expired. Please create a new reservation.',
        },
      });
    }

    // Lock the product row
    const [products] = await conn.query(
      'SELECT * FROM products WHERE id = ? FOR UPDATE',
      [reservation.product_id]
    );
    const product = products[0];

    // Confirm the reservation: move from reserved to sold (reduce reserved_stock, reduce total_stock)
    await conn.query(
      'UPDATE products SET reserved_stock = reserved_stock - ?, total_stock = total_stock - ? WHERE id = ?',
      [reservation.quantity, reservation.quantity, reservation.product_id]
    );

    // Update reservation status
    await conn.query(
      "UPDATE reservations SET status = 'confirmed', updated_at = NOW() WHERE id = ?",
      [reservation_id]
    );

    // Create order
    const orderId = uuidv4();
    const totalAmount = product.price * reservation.quantity;

    await conn.query(
      `INSERT INTO orders (id, reservation_id, user_id, total_amount, payment_id, status)
       VALUES (?, ?, ?, ?, ?, 'completed')`,
      [orderId, reservation_id, userId, totalAmount, payment_id]
    );

    // Audit log
    await conn.query(
      `INSERT INTO inventory_audit_log (id, product_id, reservation_id, order_id, action, quantity_changed, stock_before, stock_after, reason, performed_by)
       VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?, 'Payment confirmed - inventory permanently consumed', ?)`,
      [
        uuidv4(),
        reservation.product_id,
        reservation_id,
        orderId,
        reservation.quantity,
        product.reserved_stock,
        product.reserved_stock - reservation.quantity,
        userId,
      ]
    );

    await conn.commit();

    // Broadcast stock levels update via WebSocket
    const { broadcastProductUpdate } = require('../websocket');
    broadcastProductUpdate(reservation.product_id);

    // Fetch the order
    const [order] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);

    console.log(`✅ Payment confirmed: reservation ${reservation_id} → order ${orderId}`);

    res.status(201).json({
      success: true,
      message: 'Payment confirmed and order created',
      data: { order: order[0] },
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

// POST /api/payments/fail
const failPayment = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { reservation_id, reason } = req.body;
    const userId = req.user.id;

    await conn.beginTransaction();

    // Lock the reservation
    const [reservations] = await conn.query(
      'SELECT * FROM reservations WHERE id = ? AND user_id = ? FOR UPDATE',
      [reservation_id, userId]
    );

    if (reservations.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reservation not found' },
      });
    }

    const reservation = reservations[0];

    if (reservation.status !== 'pending') {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot fail payment for reservation with status '${reservation.status}'`,
        },
      });
    }

    // Lock the product row
    const [products] = await conn.query(
      'SELECT * FROM products WHERE id = ? FOR UPDATE',
      [reservation.product_id]
    );
    const product = products[0];

    // Release reserved stock back to available
    await conn.query(
      'UPDATE products SET available_stock = available_stock + ?, reserved_stock = reserved_stock - ? WHERE id = ?',
      [reservation.quantity, reservation.quantity, reservation.product_id]
    );

    // Mark reservation as cancelled
    await conn.query(
      "UPDATE reservations SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
      [reservation_id]
    );

    // Audit log
    await conn.query(
      `INSERT INTO inventory_audit_log (id, product_id, reservation_id, action, quantity_changed, stock_before, stock_after, reason, performed_by)
       VALUES (?, ?, ?, 'released', ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        reservation.product_id,
        reservation_id,
        reservation.quantity,
        product.available_stock,
        product.available_stock + reservation.quantity,
        reason || 'Payment failed',
        userId,
      ]
    );

    await conn.commit();

    // Broadcast stock levels update via WebSocket
    const { broadcastProductUpdate } = require('../websocket');
    broadcastProductUpdate(reservation.product_id);

    console.log(`✅ Payment failed: reservation ${reservation_id} cancelled, stock released`);

    res.json({
      success: true,
      message: 'Payment failure processed. Reserved inventory has been released.',
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

module.exports = { confirmPayment, failPayment };
