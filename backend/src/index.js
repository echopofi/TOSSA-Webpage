const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const config = require('./config');

const prisma = new PrismaClient();

const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const setsRoutes = require('./routes/sets');
const announcementRoutes = require('./routes/announcements');
const paymentRoutes = require('./routes/payments');
const duesRoutes = require('./routes/dues');
const webhookRoutes = require('./routes/webhooks');
const adminRoutes = require('./routes/admin');
const electionRoutes = require('./routes/elections');
const excoRoutes = require('./routes/exco');
const uploadRoutes = require('./routes/upload');

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Webhook routes need raw body — mount BEFORE express.json()
app.use('/api/webhooks', webhookRoutes);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/sets', setsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/dues', duesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/exco', excoRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await prisma.$connect();
    console.log('Database connected');
    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

module.exports = app;
