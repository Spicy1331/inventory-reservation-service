const Joi = require('joi');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(50).required()
    .messages({ 'string.empty': 'Username is required' }),
  email: Joi.string().email().required()
    .messages({ 'string.email': 'Please provide a valid email' }),
  password: Joi.string().min(6).max(100).required()
    .messages({ 'string.min': 'Password must be at least 6 characters' }),
  role: Joi.string().valid('admin', 'customer').default('customer'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required()
    .messages({ 'string.email': 'Please provide a valid email' }),
  password: Joi.string().required()
    .messages({ 'string.empty': 'Password is required' }),
});

module.exports = { registerSchema, loginSchema };
