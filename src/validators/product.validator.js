const Joi = require('joi');

const createProductSchema = Joi.object({
  name: Joi.string().min(1).max(255).required()
    .messages({ 'string.empty': 'Product name is required' }),
  description: Joi.string().max(1000).allow('', null).default(''),
  price: Joi.number().positive().precision(2).required()
    .messages({ 'number.positive': 'Price must be a positive number' }),
  total_stock: Joi.number().integer().min(0).required()
    .messages({ 'number.min': 'Total stock cannot be negative' }),
});

const updateStockSchema = Joi.object({
  adjustment: Joi.number().integer().required()
    .messages({ 'number.base': 'Stock adjustment must be an integer (positive to add, negative to reduce)' }),
  reason: Joi.string().max(255).required()
    .messages({ 'string.empty': 'Reason for stock adjustment is required' }),
});

module.exports = { createProductSchema, updateStockSchema };
