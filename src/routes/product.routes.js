const express = require('express');
const router = express.Router();
const { createProduct, getProducts, getProduct, updateStock } = require('../controllers/product.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createProductSchema, updateStockSchema } = require('../validators/product.validator');

// Public routes
router.get('/', getProducts);
router.get('/:id', getProduct);

// Admin-only routes
router.post('/', authenticate, authorize('admin'), validate(createProductSchema), createProduct);
router.patch('/:id/stock', authenticate, authorize('admin'), validate(updateStockSchema), updateStock);

module.exports = router;
