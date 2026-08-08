const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// POST /api/products (Admin only)
const createProduct = async (req, res, next) => {
  try {
    const { name, description, price, total_stock } = req.body;
    const productId = uuidv4();

    await db.query(
      `INSERT INTO products (id, name, description, price, total_stock, available_stock, reserved_stock)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [productId, name, description || '', price, total_stock, total_stock]
    );

    // Audit log: initial stock
    await db.query(
      `INSERT INTO inventory_audit_log (id, product_id, action, quantity_changed, stock_before, stock_after, reason, performed_by)
       VALUES (?, ?, 'stock_added', ?, 0, ?, 'Initial stock on product creation', ?)`,
      [uuidv4(), productId, total_stock, total_stock, req.user.id]
    );

    const [product] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);

    console.log(`✅ Product created: ${name} (stock: ${total_stock})`);

    res.status(201).json({
      success: true,
      data: { product: product[0] },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products
const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [products] = await db.query(
      'SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    const [countResult] = await db.query('SELECT COUNT(*) as total FROM products');
    const total = countResult[0].total;

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/products/:id
const getProduct = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    res.json({
      success: true,
      data: { product: rows[0] },
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/products/:id/stock (Admin only)
const updateStock = async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { adjustment, reason } = req.body;
    const productId = req.params.id;

    await conn.beginTransaction();

    // Lock the product row
    const [rows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [productId]);

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const product = rows[0];
    const newAvailableStock = product.available_stock + adjustment;
    const newTotalStock = product.total_stock + adjustment;

    // Validate: available stock cannot go negative
    if (newAvailableStock < 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: `Cannot reduce stock by ${Math.abs(adjustment)}. Only ${product.available_stock} available (${product.reserved_stock} reserved).`,
        },
      });
    }

    // Update stock
    await conn.query(
      'UPDATE products SET total_stock = ?, available_stock = ? WHERE id = ?',
      [newTotalStock, newAvailableStock, productId]
    );

    // Audit log
    await conn.query(
      `INSERT INTO inventory_audit_log (id, product_id, action, quantity_changed, stock_before, stock_after, reason, performed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        productId,
        adjustment > 0 ? 'stock_added' : 'stock_adjusted',
        adjustment,
        product.available_stock,
        newAvailableStock,
        reason,
        req.user.id,
      ]
    );

    await conn.commit();

    // Broadcast updated stock levels via WebSocket
    const { broadcastProductUpdate } = require('../websocket');
    broadcastProductUpdate(productId);

    // Fetch updated product
    const [updated] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);

    console.log(`✅ Stock updated for product ${productId}: ${adjustment > 0 ? '+' : ''}${adjustment} (reason: ${reason})`);

    res.json({
      success: true,
      data: { product: updated[0] },
    });
  } catch (error) {
    await conn.rollback();
    next(error);
  } finally {
    conn.release();
  }
};

module.exports = { createProduct, getProducts, getProduct, updateStock };
