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
} = require('./collector');

const PORT = parseInt(process.env.DASHBOARD_PORT, 10) || 8789;
const HOST = '127.0.0.1'; // Non-negotiable: local only

const app = express();
app.use(express.json());

// ── Static files ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Main API endpoint ─────────────────────────────────────────────────────
app.get('/api/summary', async (_req, res) => {
  try {
    const data = await collectAll();
    res.json(data);
  } catch (err) {
    console.error('[server] /api/summary error:', err.message);
    res.status(500).json({
      generatedAt: new Date().toISOString(),
      health: { state: 'down', reasons: ['Backend collection failed: ' + err.message] },
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
app.get('/api/probe', async (_req, res) => {
  try {
    const result = await probeConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

// ── Available actions ─────────────────────────────────────────────────────
app.get('/api/actions', (_req, res) => {
  res.json(listActions());
});

// ── Execute an action ─────────────────────────────────────────────────────
app.post('/api/action', async (req, res) => {
  const { action, targetId } = req.body || {};
  if (!action || typeof action !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing action field' });
  }
  try {
    const result = await executeAction(action, targetId || null);
    res.json(result);
  } catch (err) {
    console.error('[server] /api/action error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Logs ──────────────────────────────────────────────────────────────────
app.get('/api/logs', async (_req, res) => {
  try {
    const result = await fetchLogs();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, lines: [] });
  }
});

// ── Diagnostics (doctor) ─────────────────────────────────────────────────
app.post('/api/diagnose', async (_req, res) => {
  try {
    const result = await runDiagnostics();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, checks: [] });
  }
});

// ── Deep status ──────────────────────────────────────────────────────────
app.get('/api/status/deep', async (_req, res) => {
  try {
    const result = await fetchDeepStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Skills list ──────────────────────────────────────────────────────────
app.get('/api/skills', async (_req, res) => {
  try {
    const result = await fetchSkills();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, skills: [] });
  }
});

// ── Model management ─────────────────────────────────────────────────────
app.get('/api/models', async (_req, res) => {
  try {
    const result = await fetchModelManagement();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Security audit ───────────────────────────────────────────────────────
app.post('/api/security/audit', async (_req, res) => {
  try {
    const result = await runSecurityAudit();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Sandbox status ───────────────────────────────────────────────────────
app.get('/api/sandbox', async (_req, res) => {
  try {
    const result = await fetchSandboxStatus();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Config (safe keys only) ──────────────────────────────────────────────
app.get('/api/config', async (_req, res) => {
  try {
    const result = await fetchConfig();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Startup safety check ──────────────────────────────────────────────────
function startServer() {
  if (HOST !== '127.0.0.1' && HOST !== 'localhost' && HOST !== '::1') {
    console.error('FATAL: Dashboard MUST bind to loopback (127.0.0.1). Refusing to start.');
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`\n  ┌──────────────────────────────────────────────┐`);
    console.log(`  │  OpenClaw Systems Dashboard                  │`);
    console.log(`  │  Running at http://${HOST}:${PORT}          │`);
    console.log(`  │  Local-only · Auto-refresh 15 s              │`);
    console.log(`  └──────────────────────────────────────────────┘\n`);
  });
}

startServer();
