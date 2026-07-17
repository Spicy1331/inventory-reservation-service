const express = require('express');
const router = express.Router();
const { getProductAuditLog } = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middleware/auth');

// Admin-only route
router.use(authenticate);
router.use(authorize('admin'));

// GET /api/audit/products/:id
router.get('/products/:id', getProductAuditLog);

module.exports = router;
