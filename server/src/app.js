import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errors.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import userRoutes from './routes/users.js';
import warehouseRoutes from './routes/warehouses.js';
import notificationRoutes from './routes/notifications.js';

export function createApp() {
  const app = express();

  // Render terminates TLS at its proxy; trust exactly one hop so rate limits see real client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  // Native mobile apps don't send an Origin header; browsers are only allowed from the explicit list.
  app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));
  app.use(express.json({ limit: '50kb' }));
  app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

  // Registered before the HTTPS guard because Render's internal health checks use plain HTTP.
  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });

  if (config.isProd) {
    app.use((req, res, next) => {
      if (req.secure) return next();
      res.status(403).json({ error: 'HTTPS required' });
    });
  }

  app.use('/api/auth', authRoutes);
  app.use('/api/warehouses', warehouseRoutes);
  app.use('/api/orders', authenticate, orderRoutes);
  app.use('/api/users', authenticate, userRoutes);
  app.use('/api/notifications', authenticate, notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
