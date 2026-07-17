const express = require('express');
const router = express.Router();
const { confirmPayment, failPayment } = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { confirmPaymentSchema, failPaymentSchema } = require('../validators/payment.validator');

// All payment routes require customer authentication
router.use(authenticate);
router.use(authorize('customer'));

// POST /api/payments/confirm
router.post('/confirm', validate(confirmPaymentSchema), confirmPayment);

// POST /api/payments/fail
router.post('/fail', validate(failPaymentSchema), failPayment);

module.exports = router;
