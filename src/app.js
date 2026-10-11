const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const connectDB = require('./config/db');
connectDB();

// Global Middlewares
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
const authRoutes = require('./routes/authroutes');
const bookingRoutes = require('./routes/bookingRoutes');
const trainRoutes = require('./routes/trainRoutes');
const stationRoutes = require('./routes/stationRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const cancellationRoutes = require('./routes/cancellationRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/trains', trainRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api', cancellationRoutes);
app.use('/api', trainRoutes);


module.exports = app;
