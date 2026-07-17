const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const config = require('../config');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    // Check if user already exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'A user with this email or username already exists',
        },
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    await db.query(
      'INSERT INTO users (id, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, role || 'customer']
    );

    // Generate token
    const token = jwt.sign({ id: userId, role: role || 'customer' }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    console.log(`✅ User registered: ${username} (${role || 'customer'})`);

    res.status(201).json({
      success: true,
      data: {
        user: { id: userId, username, email, role: role || 'customer' },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      });
    }

    const user = rows[0];

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password',
        },
      });
    }

    // Generate token
    const token = jwt.sign({ id: user.id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    console.log(`✅ User logged in: ${user.username}`);

    res.json({
      success: true,
      data: {
        user: { id: user.id, username: user.username, email: user.email, role: user.role },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login };
