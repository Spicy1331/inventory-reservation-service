const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token is required. Provide it as: Bearer <token>',
        },
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    // Verify user still exists in DB
    const [rows] = await db.query('SELECT id, username, email, role FROM users WHERE id = ?', [decoded.id]);

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User no longer exists',
        },
      });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token',
        },
      });
    }
    next(error);
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role(s): ${roles.join(', ')}`,
        },
      });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
