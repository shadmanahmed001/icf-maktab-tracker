/**
 * ICF Daily Maktab — application server.
 *
 * Serves the three portals (admin, teacher, parent) from one Express process
 * plus the built React client. The database is a single SQLite file, so a
 * deployment is one process and one file to back up.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { initDb, installShutdownHooks, flush } = require('./db');
const { migrate } = require('./schema');
const { authenticate, csrfGuard, requireRole } = require('./auth');
const { ApiError } = require('./util/http');

const authRoutes = require('./routes/auth');
const sharedRoutes = require('./routes/shared');
const adminRoutes = require('./routes/admin');
const teacherRoutes = require('./routes/teacher');
const parentRoutes = require('./routes/parent');
const seedDatabase = require('./seed');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const CLIENT_DIST = path.join(__dirname, '../client/dist');

// Render, Fly and most reverse proxies terminate TLS upstream. Trusting the
// proxy lets `secure` cookies and rate-limit client IPs work correctly.
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet({
  // The client is a same-origin SPA with no external asset hosts.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(express.json({ limit: '512kb' }));
app.use(cookieParser());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Broad ceiling on API traffic; the login route adds a much tighter limit.
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.API_RATE_LIMIT || 600),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — please slow down.' },
}));

app.use(authenticate);
app.use(csrfGuard);

app.use('/api/auth', authRoutes);
app.use('/api', sharedRoutes);
app.use('/api/admin', requireRole('admin'), adminRoutes);
// Admins can act inside a classroom too, for cover and record corrections.
app.use('/api/teacher', requireRole('teacher', 'admin'), teacherRoutes);
app.use('/api/parent', requireRole('parent', 'admin'), parentRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), version: require('../package.json').version });
});

// ── Static client ───────────────────────────────────────────────────────────

if (fs.existsSync(CLIENT_DIST)) {
  // Hashed bundle filenames are safe to cache hard; index.html must not be.
  app.use(express.static(CLIENT_DIST, {
    maxAge: '1y',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));
}

/** Unknown API paths get JSON; everything else falls through to the SPA. */
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next(ApiError.notFound(`No API endpoint at ${req.method} ${req.path}`));
  }
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(503).send(
    '<h1>ICF Maktab Tracker</h1><p>The client has not been built yet. Run <code>npm run build</code>.</p>'
  );
});

// ── Errors ──────────────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.path}`, err);
  }
  res.status(status).json({
    success: false,
    error: status >= 500 ? 'Something went wrong on the server. Please try again.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
});

// ── Startup ─────────────────────────────────────────────────────────────────

async function start() {
  await initDb();
  installShutdownHooks();
  migrate();

  const { value } = require('./db');
  const termCount = value(`SELECT COUNT(*) FROM terms`, [], 0);
  if (termCount === 0) {
    console.log('[seed] empty database detected — seeding curriculum and demo data');
    seedDatabase();
    flush();
  }

  const server = app.listen(PORT, () => {
    console.log('────────────────────────────────────────────────────────');
    console.log('  ICF Daily Maktab — Academic Tracker');
    console.log(`  Listening on http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('────────────────────────────────────────────────────────');
  });

  // Give in-flight requests a moment, then flush the database and exit.
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => server.close());
  }
  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
