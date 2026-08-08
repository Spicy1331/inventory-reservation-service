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

const { expireReservations } = require('./jobs/expiryWorker');

// --------------- Routes ---------------
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/audit', auditRoutes);

// Cron trigger route for serverless environments (e.g. Vercel Crons)
app.get('/api/cron/expire-reservations', async (req, res, next) => {
  // Validate request is authorized (optional security check using CRON_SECRET)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Unauthorized cron trigger invocation',
      }
    });
  }

  try {
    console.log('⏱️ Cron: Triggering reservation expiry sweep...');
    await expireReservations();
    res.json({
      success: true,
      message: 'Reservation expiry sweep executed successfully',
    });
  } catch (error) {
    next(error);
  }
});

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
