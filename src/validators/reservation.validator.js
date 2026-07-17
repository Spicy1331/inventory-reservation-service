const Joi = require('joi');

const createReservationSchema = Joi.object({
  product_id: Joi.string().uuid().required()
    .messages({ 'string.guid': 'Product ID must be a valid UUID' }),
  quantity: Joi.number().integer().min(1).required()
    .messages({
      'number.min': 'Quantity must be at least 1',
      'number.base': 'Quantity must be a number',
    }),
});

module.exports = { createReservationSchema };
