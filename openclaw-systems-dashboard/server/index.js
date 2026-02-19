'use strict';

const express = require('express');
const path = require('path');
const { collectAll } = require('./collector');

const PORT = parseInt(process.env.DASHBOARD_PORT, 10) || 8789;
const HOST = '127.0.0.1'; // Non-negotiable: local only

const app = express();

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
