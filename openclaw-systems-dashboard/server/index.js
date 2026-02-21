'use strict';

const express = require('express');
const path = require('path');
const {
  collectAll,
  executeAction,
  fetchLogs,
  runDiagnostics,
  probeConnection,
  listActions,
  fetchDeepStatus,
  fetchSkills,
  fetchModelManagement,
  runSecurityAudit,
  fetchSandboxStatus,
  fetchConfig,
  fetchSystemResources,
} = require('./collector');

const PORT = parseInt(process.env.DASHBOARD_PORT, 10) || 8789;
const HOST = process.env.DASHBOARD_HOST || '127.0.0.1';
const TOKEN = process.env.DASHBOARD_TOKEN || '';
const REMOTE_MODE = HOST === '0.0.0.0' || (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1');

const app = express();

// ── Security: JSON body size limit (10 KB) ───────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Security: hardened HTTP headers ──────────────────────────────────────
app.use((_req, res, next) => {
  // Prevent embedding in iframes (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Strict referrer policy
  res.setHeader('Referrer-Policy', 'no-referrer');
  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Disable caching of API responses (prevent stale sensitive data)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  // Content Security Policy — only allow same-origin resources
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );
  // Permissions policy — disable unnecessary browser features
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

// ── Security: token authentication (required for remote mode) ────────────
if (REMOTE_MODE) {
  app.use((req, res, next) => {
    // Allow the login page itself to load
    if (req.path === '/' || req.path === '/index.html' ||
        req.path.endsWith('.css') || req.path.endsWith('.js') ||
        req.path === '/favicon.ico') {
      return next();
    }
    const provided = req.headers['x-dashboard-token'] || req.query.token;
    if (!provided || provided !== TOKEN) {
      return res.status(401).json({ error: 'Unauthorized — invalid or missing token' });
    }
    next();
  });
}

// ── Security: simple in-memory rate limiter ──────────────────────────────
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60_000; // 1 minute window
const RATE_LIMIT_READ = 120;   // 120 read requests per minute
const RATE_LIMIT_WRITE = 20;   // 20 mutating actions per minute

function rateLimit(key, limit) {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    rateLimitMap.set(key, entry);
  }
  entry.count++;
  return entry.count > limit;
}

// Clean up rate limit entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [key, entry] of rateLimitMap) {
    if (entry.windowStart < cutoff) rateLimitMap.delete(key);
  }
}, 300_000);

// ── Security: action audit log (in-memory, last 200 entries) ─────────────
const auditLog = [];
const AUDIT_LOG_MAX = 200;

function logAudit(action, targetId, success, error) {
  auditLog.push({
    timestamp: new Date().toISOString(),
    action,
    targetId: targetId || null,
    success,
    error: error || null,
  });
  if (auditLog.length > AUDIT_LOG_MAX) auditLog.shift();
}

// ── Security: sanitize error messages for client ─────────────────────────
function safeError(err) {
  const msg = err && err.message ? err.message : 'Internal server error';
  // Strip file paths and stack traces
  return msg.replace(/\/[\w/.]+/g, '[path]').slice(0, 200);
}

// ── Static files ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Main API endpoint ─────────────────────────────────────────────────────
app.get('/api/summary', async (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const data = await collectAll();
    res.json(data);
  } catch (err) {
    console.error('[server] /api/summary error:', err.message);
    res.status(500).json({
      generatedAt: new Date().toISOString(),
      health: { state: 'down', reasons: ['Backend collection failed'] },
      gateway: { running: false },
      stats: { modelsCount: '—', cronCount: '—', channelsCount: '—', sessionLife: '—' },
      models: [],
      cronJobs: [],
      channels: [],
      pipeline: [],
      features: [],
    });
  }
});

// ── Connection probe ──────────────────────────────────────────────────────
app.get('/api/probe', async (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await probeConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ connected: false, error: safeError(err) });
  }
});

// ── Available actions ─────────────────────────────────────────────────────
app.get('/api/actions', (_req, res) => {
  res.json(listActions());
});

// ── Execute an action ─────────────────────────────────────────────────────
app.post('/api/action', async (req, res) => {
  if (rateLimit(req.ip + ':write', RATE_LIMIT_WRITE)) {
    return res.status(429).json({ success: false, error: 'Rate limit exceeded — too many actions' });
  }
  const { action, targetId } = req.body || {};
  if (!action || typeof action !== 'string' || action.length > 64) {
    return res.status(400).json({ success: false, error: 'Invalid action field' });
  }
  if (targetId && (typeof targetId !== 'string' || targetId.length > 128)) {
    return res.status(400).json({ success: false, error: 'Invalid target ID' });
  }
  try {
    const result = await executeAction(action, targetId || null);
    logAudit(action, targetId, result.success, result.error);
    res.json(result);
  } catch (err) {
    console.error('[server] /api/action error:', err.message);
    logAudit(action, targetId, false, safeError(err));
    res.status(500).json({ success: false, error: safeError(err) });
  }
});

// ── Logs ──────────────────────────────────────────────────────────────────
app.get('/api/logs', async (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await fetchLogs();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: safeError(err), lines: [] });
  }
});

// ── Diagnostics (doctor) ─────────────────────────────────────────────────
app.post('/api/diagnose', async (req, res) => {
  if (rateLimit(req.ip + ':write', RATE_LIMIT_WRITE)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await runDiagnostics();
    logAudit('diagnose', null, true, null);
    res.json(result);
  } catch (err) {
    logAudit('diagnose', null, false, safeError(err));
    res.status(500).json({ success: false, error: safeError(err), checks: [] });
  }
});

// ── Deep status ──────────────────────────────────────────────────────────
app.get('/api/status/deep', async (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await fetchDeepStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: safeError(err) });
  }
});

// ── Skills list ──────────────────────────────────────────────────────────
app.get('/api/skills', async (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await fetchSkills();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: safeError(err), skills: [] });
  }
});

// ── Model management ─────────────────────────────────────────────────────
app.get('/api/models', async (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await fetchModelManagement();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: safeError(err) });
  }
});

// ── Security audit ───────────────────────────────────────────────────────
app.post('/api/security/audit', async (req, res) => {
  if (rateLimit(req.ip + ':write', RATE_LIMIT_WRITE)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await runSecurityAudit();
    logAudit('securityAudit', null, true, null);
    res.json(result);
  } catch (err) {
    logAudit('securityAudit', null, false, safeError(err));
    res.status(500).json({ success: false, error: safeError(err) });
  }
});

// ── Sandbox status ───────────────────────────────────────────────────────
app.get('/api/sandbox', async (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await fetchSandboxStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: safeError(err) });
  }
});

// ── System resources ────────────────────────────────────────────────
app.get('/api/system/resources', (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = fetchSystemResources();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: safeError(err) });
  }
});

// ── Config (safe keys only) ──────────────────────────────────────────────
app.get('/api/config', async (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  try {
    const result = await fetchConfig();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: safeError(err) });
  }
});

// ── Audit log endpoint (read-only) ──────────────────────────────────────
app.get('/api/audit-log', (req, res) => {
  if (rateLimit(req.ip + ':read', RATE_LIMIT_READ)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  res.json({ success: true, entries: auditLog.slice(-50).reverse() });
});

// ── 404 catch-all for unknown API routes ─────────────────────────────────
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Startup safety check ──────────────────────────────────────────────────
function startServer() {
  if (REMOTE_MODE && !TOKEN) {
    console.error('FATAL: DASHBOARD_TOKEN is required when binding to a non-loopback address.');
    console.error('  Set DASHBOARD_TOKEN=<your-secret> to enable remote access.');
    process.exit(1);
  }

  const mode = REMOTE_MODE ? 'Remote (token-protected)' : 'Local-only';
  const url = `http://${HOST === '0.0.0.0' ? '<your-ip>' : HOST}:${PORT}`;

  app.listen(PORT, HOST, () => {
    console.log(`\n  ┌──────────────────────────────────────────────┐`);
    console.log(`  │  OpenClaw Systems Dashboard                  │`);
    console.log(`  │  ${url.padEnd(42)}│`);
    console.log(`  │  ${mode.padEnd(42)}│`);
    console.log(`  │  Auto-refresh 15 s                           │`);
    console.log(`  │  Security: headers + rate-limit + audit log  │`);
    console.log(`  └──────────────────────────────────────────────┘\n`);
  });
}

startServer();
