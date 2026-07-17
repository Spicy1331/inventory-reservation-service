const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');

// POST /api/reservations
const createReservation = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { product_id, quantity } = req.body;
    const userId = req.user.id;

    // Idempotency check: if client sends Idempotency-Key header
    const idempotencyKey = req.headers['idempotency-key'] || null;

    if (idempotencyKey) {
      const [existing] = await conn.query(
        'SELECT * FROM reservations WHERE idempotency_key = ?',
        [idempotencyKey]
      );

      if (existing.length > 0) {
        conn.release();
        console.log(`ℹ️  Duplicate reservation request (idempotency key: ${idempotencyKey})`);
        return res.status(200).json({
          success: true,
          message: 'Reservation already exists (idempotent response)',
          data: { reservation: existing[0] },
        });
      }
    }

    await conn.beginTransaction();

    // ========== CRITICAL SECTION: Lock the product row ==========
    const [products] = await conn.query(
      'SELECT * FROM products WHERE id = ? FOR UPDATE',
      [product_id]
    );

    if (products.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const product = products[0];

    // Check if enough stock is available
    if (product.available_stock < quantity) {
      await conn.rollback();
      conn.release();
      return res.status(409).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Only ${product.available_stock} units available, but ${quantity} were requested`,
        },
      });
    }

    // Reserve the stock
    const reservationId = uuidv4();
    const expiresAt = new Date(Date.now() + config.reservationTTLMinutes * 60 * 1000);

    // Update product stock: decrease available, increase reserved
    await conn.query(
      'UPDATE products SET available_stock = available_stock - ?, reserved_stock = reserved_stock + ? WHERE id = ?',
      [quantity, quantity, product_id]
    );

    // Create reservation record
    await conn.query(
      `INSERT INTO reservations (id, user_id, product_id, quantity, status, idempotency_key, expires_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [reservationId, userId, product_id, quantity, idempotencyKey, expiresAt]
    );

    // Audit log
    await conn.query(
      `INSERT INTO inventory_audit_log (id, product_id, reservation_id, action, quantity_changed, stock_before, stock_after, reason, performed_by)
       VALUES (?, ?, ?, 'reserved', ?, ?, ?, 'Inventory reserved by customer', ?)`,
      [
        uuidv4(),
        product_id,
        reservationId,
        quantity,
        product.available_stock,
        product.available_stock - quantity,
        userId,
      ]
    );

    await conn.commit();
    // ========== END CRITICAL SECTION ==========

    // Fetch the created reservation
    const [reservation] = await db.query('SELECT * FROM reservations WHERE id = ?', [reservationId]);

    console.log(`✅ Reservation created: ${reservationId} (${quantity} units of product ${product_id}, expires: ${expiresAt.toISOString()})`);

    res.status(201).json({
      success: true,
      data: { reservation: reservation[0] },
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

// GET /api/reservations (user's own reservations)
const getReservations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const status = req.query.status;

    let query = `
      SELECT r.*, p.name as product_name, p.price as product_price
      FROM reservations r
      JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ?
    `;
    const params = [userId];

    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const [reservations] = await db.query(query, params);

    res.json({
      success: true,
      data: { reservations },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/reservations/:id
const getReservation = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, p.name as product_name, p.price as product_price
       FROM reservations r
       JOIN products p ON r.product_id = p.id
       WHERE r.id = ? AND r.user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Reservation not found' },
      });
    }

    res.json({
      success: true,
      data: { reservation: rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/reservations/:id (cancel a pending reservation)
const cancelReservation = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const reservationId = req.params.id;
    const userId = req.user.id;

    await conn.beginTransaction();

    // Lock the reservation
    const [reservations] = await conn.query(
      'SELECT * FROM reservations WHERE id = ? AND user_id = ? FOR UPDATE',
      [reservationId, userId]
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
          message: `Cannot cancel reservation with status '${reservation.status}'. Only 'pending' reservations can be cancelled.`,
        },
      });
    }

    // Lock the product row
    const [products] = await conn.query(
      'SELECT * FROM products WHERE id = ? FOR UPDATE',
      [reservation.product_id]
    );
    const product = products[0];

    // Release the reserved stock
    await conn.query(
      'UPDATE products SET available_stock = available_stock + ?, reserved_stock = reserved_stock - ? WHERE id = ?',
      [reservation.quantity, reservation.quantity, reservation.product_id]
    );

    // Mark reservation as cancelled
    await conn.query(
      "UPDATE reservations SET status = 'cancelled', updated_at = NOW() WHERE id = ?",
      [reservationId]
    );

    // Audit log
    await conn.query(
      `INSERT INTO inventory_audit_log (id, product_id, reservation_id, action, quantity_changed, stock_before, stock_after, reason, performed_by)
       VALUES (?, ?, ?, 'released', ?, ?, ?, 'Reservation cancelled by customer', ?)`,
      [
        uuidv4(),
        reservation.product_id,
        reservationId,
        reservation.quantity,
        product.available_stock,
        product.available_stock + reservation.quantity,
        userId,
      ]
    );

    await conn.commit();

    console.log(`✅ Reservation cancelled: ${reservationId}`);

    res.json({
      success: true,
      message: 'Reservation cancelled and inventory released',
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

module.exports = { createReservation, getReservations, getReservation, cancelReservation };
