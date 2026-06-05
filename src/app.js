import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import viloyatlarRoutes from './routes/viloyatlar.routes.js';
import tumansRoutes from './routes/tumans.routes.js';
import mfyRoutes from './routes/mfy.routes.js';
import hududRoutes from './routes/hudud.routes.js';
import visitRoutes from './routes/visit.routes.js';
import workersRoutes from './routes/workers.routes.js';
import devicesRoutes from './routes/devices.routes.js';
import readingsRoutes from './routes/readings.routes.js';
import alertsRoutes from './routes/alerts.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import logsRoutes from './routes/logs.routes.js';
import ingestRoutes from './routes/ingest.routes.js';
import deviceModelsRoutes from './routes/deviceModels.routes.js';
import pointsRoutes from './routes/points.routes.js';

export const app = express();

/* Helmet — CSP'ni xarita tile serverlariga ruxsat berib sozlaymiz */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          // Carto (Voyager, Dark Matter, Positron)
          'https://*.basemaps.cartocdn.com',
          // OpenStreetMap
          'https://*.tile.openstreetmap.org',
          'https://tile.openstreetmap.org',
          // Google Maps tiles (street/satellite/hybrid)
          'https://mt0.google.com',
          'https://mt1.google.com',
          'https://mt2.google.com',
          'https://mt3.google.com',
          // Esri ArcGIS (zaxira)
          'https://server.arcgisonline.com',
          'https://services.arcgisonline.com',
        ],
        // WebGL/tile fetch uchun
        'connect-src': ["'self'", 'https://*.basemaps.cartocdn.com'],
      },
    },
    // Cross-origin tile fetch uchun
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 10_000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

/* IoT device ingest — separate high-throughput limiter, no JWT auth */
const ingestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/ingest', ingestLimiter, ingestRoutes);

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV, time: new Date().toISOString() });
});

/**
 * Vaqtinchalik seed endpoint — Atlas'ni bir martalik to'ldirish uchun.
 * SEED_TOKEN env bo'lsa, faqat shu token bilan ishlaydi.
 * Seed bo'lgach SEED_TOKEN ni Render'dan o'chirib, bu endpoint avtomatik o'chiriladi.
 */
app.post('/api/admin/seed', async (req, res) => {
  const token = req.headers['x-seed-token'];
  if (!process.env.SEED_TOKEN) {
    return res.status(403).json({ error: { message: 'Seed disabled (SEED_TOKEN o\'chirilgan)' } });
  }
  if (token !== process.env.SEED_TOKEN) {
    return res.status(401).json({ error: { message: 'Invalid seed token' } });
  }
  try {
    const { runSeed } = await import('./seed/seed.js');
    const result = await runSeed({ skipConnect: true });
    res.json({ ok: true, result, login: { admin: 'admin/admin123', ishchi1: 'ishchi1/ishchi123' } });
  } catch (err) {
    console.error('SEED endpoint xato:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/viloyatlar', viloyatlarRoutes);
app.use('/api/tumans', tumansRoutes);
app.use('/api/mfy',     mfyRoutes);
app.use('/api/hududs',  hududRoutes);
app.use('/api/visits',  visitRoutes);
app.use('/api/workers', workersRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/readings', readingsRoutes);
app.use('/api/alerts',  alertsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/device-models', deviceModelsRoutes);
app.use('/api/points', pointsRoutes);

/* ── Static frontend (production) ─────────────────────────────────── */
const PUBLIC_DIR = path.join(__dirname, '../public');
app.use(express.static(PUBLIC_DIR));

/* SPA fallback — serve index.html for every non-API route */
app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/ingest') ||
    req.path === '/health'
  ) {
    return next();
  }
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
    if (err) next(); // index.html yo'q bo'lsa 404 ga o'tadi
  });
});

app.use(notFoundHandler);
app.use(errorHandler);
