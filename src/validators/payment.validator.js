const Joi = require('joi');

const confirmPaymentSchema = Joi.object({
  reservation_id: Joi.string().uuid().required()
    .messages({ 'string.guid': 'Reservation ID must be a valid UUID' }),
  payment_id: Joi.string().min(1).max(255).required()
    .messages({ 'string.empty': 'Payment ID is required' }),
});

const failPaymentSchema = Joi.object({
  reservation_id: Joi.string().uuid().required()
    .messages({ 'string.guid': 'Reservation ID must be a valid UUID' }),
  reason: Joi.string().max(255).default('Payment failed'),
});

module.exports = { confirmPaymentSchema, failPaymentSchema };
