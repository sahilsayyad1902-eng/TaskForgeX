require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const initDb = require('./initDb');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const feedbackRoutes = require('./routes/feedback');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
}

const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5500,http://localhost:5500').split(',').map(x => x.trim()).filter(Boolean);
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('Origin not allowed by CORS.')); } }));
app.use(express.json({ limit: '20kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }), authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/feedback', feedbackRoutes);
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); return res.json({ status: 'ok', database: 'connected' }); }
  catch { return res.status(503).json({ status: 'error', database: 'unavailable' }); }
});
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, _req, res, _next) => {
  if (error.message === 'Origin not allowed by CORS.') return res.status(403).json({ error: error.message });
  if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That value already exists.' });
  console.error(error);
  return res.status(500).json({ error: 'Unexpected server error.' });
});

const port = Number(process.env.PORT || 4000);
async function start() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await initDb();
      app.listen(port, '0.0.0.0', () => console.log(`TaskForgeX API listening on port ${port}`));
      return;
    } catch (error) {
      console.error(`Database not ready (attempt ${attempt}/10): ${error.message}`);
      if (attempt === 10) process.exit(1);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
}
start();
