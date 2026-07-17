const db = require('../db');

// GET /api/audit/products/:id
const getProductAuditLog = async (req, res, next) => {
  try {
    const productId = req.params.id;

    // Check product exists
    const [products] = await db.query('SELECT id, name FROM products WHERE id = ?', [productId]);

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    // Fetch audit logs with performer info
    const [logs] = await db.query(
      `SELECT 
        a.id,
        a.product_id,
        a.reservation_id,
        a.order_id,
        a.action,
        a.quantity_changed,
        a.stock_before,
        a.stock_after,
        a.reason,
        a.performed_by,
        u.username as performed_by_username,
        a.created_at
       FROM inventory_audit_log a
       LEFT JOIN users u ON a.performed_by = u.id
       WHERE a.product_id = ?
       ORDER BY a.created_at DESC`,
      [productId]
    );

    res.json({
      success: true,
      data: {
        product: products[0],
        audit_log: logs,
        total_entries: logs.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getProductAuditLog };
