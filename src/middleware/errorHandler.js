// Global error handler middleware
const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  console.error(err.stack);

  // Joi validation error
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.details.map((d) => d.message).join(', '),
      },
    });
  }

  // MySQL duplicate entry error
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this value already exists',
      },
    });
  }

  // MySQL check constraint violation
  if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED' || err.errno === 3819) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONSTRAINT_VIOLATION',
        message: 'Operation would violate data integrity constraints',
      },
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'Internal server error' : err.message,
    },
  });
};

module.exports = errorHandler;
