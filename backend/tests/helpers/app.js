const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const config = require('../../src/config');

const prisma = new PrismaClient();

function createTestApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.frontendUrl, credentials: true }));

  const webhookRoutes = require('../../src/routes/webhooks');
  app.use('/api/webhooks', webhookRoutes);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  const authRoutes = require('../../src/routes/auth');
  const memberRoutes = require('../../src/routes/members');
  const announcementRoutes = require('../../src/routes/announcements');
  const paymentRoutes = require('../../src/routes/payments');
  const duesRoutes = require('../../src/routes/dues');
  const adminRoutes = require('../../src/routes/admin');
  const electionRoutes = require('../../src/routes/elections');
  const excoRoutes = require('../../src/routes/exco');
  const uploadRoutes = require('../../src/routes/upload');

  app.use('/api/auth', authRoutes);
  app.use('/api/members', memberRoutes);
  app.use('/api/announcements', announcementRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/dues', duesRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/elections', electionRoutes);
  app.use('/api/exco', excoRoutes);
  app.use('/api/upload', uploadRoutes);

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  return { app, prisma };
}

module.exports = { createTestApp, prisma };
