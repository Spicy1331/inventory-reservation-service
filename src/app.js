const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const reservationRoutes = require('./routes/reservation.routes');
const paymentRoutes = require('./routes/payment.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// --------------- Serve Frontend ---------------
app.use(express.static(path.join(__dirname, '..', 'public')));

// --------------- Health Check ---------------
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Inventory Reservation Service is running',
    timestamp: new Date().toISOString(),
  });
});

// --------------- Routes ---------------
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/audit', auditRoutes);

// --------------- 404 Handler ---------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
});

// --------------- Global Error Handler ---------------
app.use(errorHandler);

module.exports = app;
