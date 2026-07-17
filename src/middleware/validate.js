// Joi validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join(', '),
        },
      });
    }

    // Replace body with validated/sanitized values
    req.body = value;
    next();
  };
};

// Validate query parameters
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details.map((d) => d.message).join(', '),
        },
      });
    }

    req.query = value;
    next();
  };
};

module.exports = { validate, validateQuery };
