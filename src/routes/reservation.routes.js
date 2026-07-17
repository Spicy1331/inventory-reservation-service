const express = require('express');
const router = express.Router();
const { createReservation, getReservations, getReservation, cancelReservation } = require('../controllers/reservation.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createReservationSchema } = require('../validators/reservation.validator');

// All reservation routes require authentication as customer
router.use(authenticate);
router.use(authorize('customer'));

// POST /api/reservations
router.post('/', validate(createReservationSchema), createReservation);

// GET /api/reservations
router.get('/', getReservations);

// GET /api/reservations/:id
router.get('/:id', getReservation);

// DELETE /api/reservations/:id
router.delete('/:id', cancelReservation);

module.exports = router;
