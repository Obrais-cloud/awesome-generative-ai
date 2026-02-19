'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const Cache = require('./cache');
const { redact } = require('./redactor');

const COMMAND_TIMEOUT = 10_000; // 10 s per CLI call
const cache = new Cache(5000);  // 5 s TTL

// ---------------------------------------------------------------------------
// Strict allowlist of CLI commands we will ever run
// ---------------------------------------------------------------------------
const ALLOWED_COMMANDS = {
  status:       { args: ['status', '--json'] },
  cronList:     { args: ['cron', 'list', '--json', '--all'] },
  cronRuns:     { args: ['cron', 'runs', '--json'] },
  channelsList: { args: ['channels', 'list', '--json'] },
  channelsStat: { args: ['channels', 'status', '--json'] },
  agentsList:   { args: ['agents', 'list', '--json'] },
  hooksList:    { args: ['hooks', 'list', '--json'] },
  gatewayStat:  { args: ['gateway', 'status'] },
};

// Resolve openclaw binary — honour env override
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run a single CLI command from the allowlist. Returns parsed JSON or raw text.
 */
function runCommand(key) {
  const spec = ALLOWED_COMMANDS[key];
  if (!spec) return Promise.reject(new Error(`Unknown command key: ${key}`));

  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise((resolve) => {
    execFile(OPENCLAW_BIN, spec.args, { timeout: COMMAND_TIMEOUT }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[collector] ${key} failed: ${err.message}`);
        resolve({ _error: true, message: err.message });
        return;
      }
      let result;
      try {
        result = JSON.parse(stdout);
      } catch {
        // Not JSON — return raw trimmed string
        result = { _raw: stdout.trim() };
      }
      cache.set(key, result);
      resolve(result);
    });
  });
}

/**
 * Load the optional model-stack override file.
 */
function loadModelOverride() {
  try {
    const fp = path.join(__dirname, 'model-stack.override.json');
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gateway status parser (text output)
// ---------------------------------------------------------------------------
function parseGatewayStatus(data) {
  if (!data || data._error) {
    return { running: false, bind: null, port: null, pid: null, rpcOk: false, _state: 'unknown' };
  }
  const text = data._raw || JSON.stringify(data);
  const running = /running/i.test(text);
  const bindMatch = text.match(/bind[:\s]+([\d.]+)/i);
  const portMatch = text.match(/port[:\s]+(\d+)/i);
  const pidMatch = text.match(/pid[:\s]+(\d+)/i);
  const rpcOk = /rpc\s*(ok|healthy|connected)/i.test(text);

  return {
    running,
    bind: bindMatch ? bindMatch[1] : null,
    port: portMatch ? parseInt(portMatch[1], 10) : null,
    pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
    rpcOk,
    _state: running ? 'ok' : 'down',
  };
}

// ---------------------------------------------------------------------------
// Model stack builder
// ---------------------------------------------------------------------------
function buildModels(agentsData) {
  const override = loadModelOverride();
  const overrideModels = override && Array.isArray(override.models) ? override.models : [];

  // Try to extract models from agents CLI output
  let liveModels = [];
  if (agentsData && !agentsData._error) {
    const agents = Array.isArray(agentsData) ? agentsData : (agentsData.agents || agentsData.models || []);
    liveModels = agents.map((a) => ({
      alias: a.alias || a.model || a.name || '',
      displayName: a.displayName || a.display_name || a.model || a.name || '',
      role: a.role || a.description || '',
      badge: a.badge || (a.free ? 'Free' : a.oauth ? 'OAuth' : 'Paid'),
      primary: !!a.primary,
    }));
  }

  // Merge: live data wins for matching aliases, override fills gaps
  if (liveModels.length > 0) {
    const liveMap = new Map(liveModels.map((m) => [m.alias.toLowerCase(), m]));
    const merged = [];
    const seen = new Set();
    // Live models first
    for (const m of liveModels) {
      const ov = overrideModels.find((o) => o.alias.toLowerCase() === m.alias.toLowerCase());
      merged.push({
        ...m,
        displayName: m.displayName || (ov && ov.displayName) || m.alias,
        role: m.role || (ov && ov.role) || '',
        badge: m.badge || (ov && ov.badge) || 'Paid',
        primary: m.primary || (ov && ov.primary) || false,
      });
      seen.add(m.alias.toLowerCase());
    }
    // Override-only models
    for (const o of overrideModels) {
      if (!seen.has(o.alias.toLowerCase())) {
        merged.push(o);
      }
    }
    return merged;
  }

  // Fallback: pure override
  return overrideModels;
}

// ---------------------------------------------------------------------------
// Cron jobs builder
// ---------------------------------------------------------------------------
function buildCronJobs(cronListData, cronRunsData) {
  if (!cronListData || cronListData._error) return [];

  const jobs = Array.isArray(cronListData) ? cronListData : (cronListData.jobs || cronListData.crons || []);
  const runs = cronRunsData && !cronRunsData._error
    ? (Array.isArray(cronRunsData) ? cronRunsData : (cronRunsData.runs || []))
    : [];

  return jobs.map((job) => {
    const id = job.id || job.name;
    const lastRun = runs.find((r) => (r.jobId || r.cronId || r.name) === id);
    let status = 'Unknown';
    if (job.enabled === false || job.disabled === true || job.status === 'disabled') {
      status = 'Disabled';
    } else if (lastRun && (lastRun.status === 'failed' || lastRun.exitCode !== 0)) {
      status = 'Failed';
    } else if (job.enabled !== false && job.disabled !== true) {
      status = 'Active';
    }
    return {
      name: job.name || job.id || 'Unnamed',
      schedule: job.schedule || job.cron || job.expression || '—',
      status,
      lastRun: lastRun ? (lastRun.finishedAt || lastRun.timestamp || null) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Channels builder
// ---------------------------------------------------------------------------
function buildChannels(channelsListData, channelsStatData) {
  if (!channelsListData || channelsListData._error) return [];

  const channels = Array.isArray(channelsListData)
    ? channelsListData
    : (channelsListData.channels || []);

  const statMap = new Map();
  if (channelsStatData && !channelsStatData._error) {
    const stats = Array.isArray(channelsStatData)
      ? channelsStatData
      : (channelsStatData.channels || []);
    for (const s of stats) {
      statMap.set((s.name || s.type || '').toLowerCase(), s);
    }
  }

  return channels.map((ch) => {
    const name = ch.name || ch.type || 'Unknown';
    const stat = statMap.get(name.toLowerCase());
    let status = 'Unknown';
    if (stat) {
      if (stat.status === 'active' || stat.healthy === true || stat.connected === true) {
        status = 'Active';
      } else if (stat.status === 'degraded') {
        status = 'Degraded';
      } else if (stat.status === 'down' || stat.healthy === false || stat.connected === false) {
        status = 'Down';
      }
    } else if (ch.enabled === true || ch.active === true || ch.status === 'active') {
      status = 'Active';
    } else if (ch.enabled === false) {
      status = 'Down';
    }
    return { name, status, type: ch.type || name };
  });
}

// ---------------------------------------------------------------------------
// Pipeline builder (Gmail → Pub/Sub → Tailscale → Hook → Agent → Telegram)
// ---------------------------------------------------------------------------
function buildPipeline(gatewayInfo, hooksData, channelsInfo) {
  const hooksList = hooksData && !hooksData._error
    ? (Array.isArray(hooksData) ? hooksData : (hooksData.hooks || []))
    : [];
  const hasHooks = hooksList.length > 0;
  const telegramUp = channelsInfo.some(
    (c) => /telegram/i.test(c.name) && c.status === 'Active'
  );

  return [
    { name: 'Gmail', state: 'Unknown', detail: 'External service — cannot observe directly' },
    { name: 'Pub/Sub', state: 'Unknown', detail: 'External service — cannot observe directly' },
    {
      name: 'Tailscale Funnel',
      state: gatewayInfo.running ? 'OK' : 'Unknown',
      detail: gatewayInfo.running ? 'Gateway is running' : 'Cannot determine tunnel state',
    },
    {
      name: 'OpenClaw Hook',
      state: hasHooks ? 'OK' : 'Unknown',
      detail: hasHooks ? `${hooksList.length} hook(s) registered` : 'No hooks data',
    },
    {
      name: 'GPT Agent',
      state: hasHooks && gatewayInfo.running ? 'OK' : 'Unknown',
      detail: 'Inferred from gateway + hooks',
    },
    {
      name: 'Telegram',
      state: telegramUp ? 'OK' : (channelsInfo.some((c) => /telegram/i.test(c.name)) ? 'Down' : 'Unknown'),
      detail: telegramUp ? 'Channel active' : 'Channel not confirmed active',
    },
  ];
}

// ---------------------------------------------------------------------------
// Health summary
// ---------------------------------------------------------------------------
function computeHealth(gateway, cronJobs, channels, pipeline) {
  const reasons = [];
  if (!gateway.running) reasons.push('Gateway not running');
  const failedCrons = cronJobs.filter((j) => j.status === 'Failed');
  if (failedCrons.length) reasons.push(`${failedCrons.length} cron job(s) failed`);
  const downChannels = channels.filter((c) => c.status === 'Down');
  if (downChannels.length) reasons.push(`${downChannels.length} channel(s) down`);
  const downNodes = pipeline.filter((n) => n.state === 'Down');
  if (downNodes.length) reasons.push(`${downNodes.length} pipeline node(s) down`);

  let state = 'ok';
  if (reasons.length > 0 && downNodes.length === 0 && !failedCrons.length) state = 'warn';
  if (failedCrons.length || downChannels.length || downNodes.length || !gateway.running) state = 'warn';
  if (downChannels.length > 1 || downNodes.length > 2) state = 'down';

  return { state, reasons };
}

// ---------------------------------------------------------------------------
// Features (static baseline with optional live detection)
// ---------------------------------------------------------------------------
function buildFeatures(gateway) {
  return [
    { name: 'Multi-Model AI Stack', description: '5 AI models with automatic failover', detected: null },
    { name: 'Smart Email Processing', description: 'Gmail → AI pipeline with auto-classification', detected: null },
    { name: 'Automated Scheduling', description: 'Cron-based tasks for news, markets & content', detected: null },
    { name: 'Secure Local Gateway', description: 'Localhost-bound reverse proxy',
      detected: gateway.running && (gateway.bind === '127.0.0.1' || gateway.bind === 'localhost') ? true : null },
    { name: 'Real-Time Notifications', description: 'Telegram & Discord integration', detected: null },
    { name: 'Privacy First', description: 'All data processed locally on device', detected: true },
  ];
}

// ---------------------------------------------------------------------------
// Main collector — runs all CLI calls concurrently, builds summary
// ---------------------------------------------------------------------------
async function collectAll() {
  const [
    statusData,
    cronListData,
    cronRunsData,
    channelsListData,
    channelsStatData,
    agentsData,
    hooksData,
    gatewayData,
  ] = await Promise.all([
    runCommand('status'),
    runCommand('cronList'),
    runCommand('cronRuns'),
    runCommand('channelsList'),
    runCommand('channelsStat'),
    runCommand('agentsList'),
    runCommand('hooksList'),
    runCommand('gatewayStat'),
  ]);

  const gateway = parseGatewayStatus(gatewayData);
  const models = buildModels(agentsData);
  const cronJobs = buildCronJobs(cronListData, cronRunsData);
  const channels = buildChannels(channelsListData, channelsStatData);
  const pipeline = buildPipeline(gateway, hooksData, channels);
  const features = buildFeatures(gateway);
  const health = computeHealth(gateway, cronJobs, channels, pipeline);

  // Derive stats
  const stats = {
    modelsCount: models.length || '—',
    cronCount: cronJobs.length || '—',
    channelsCount: channels.length || '—',
    sessionLife: '—', // Only show if reliably derivable
  };

  // Try to extract session life from status
  if (statusData && !statusData._error) {
    const sl = statusData.sessionLife || statusData.session_life || statusData.sessionTTL;
    if (sl) stats.sessionLife = String(sl);
  }

  // Try to get agent name
  let agentName = '[AGENT_NAME]';
  if (agentsData && !agentsData._error) {
    const agents = Array.isArray(agentsData) ? agentsData : (agentsData.agents || []);
    if (agents.length > 0) {
      agentName = agents[0].agentName || agents[0].agent_name || agents[0].name || agentName;
    }
  }
  if (statusData && !statusData._error && (statusData.agentName || statusData.agent_name)) {
    agentName = statusData.agentName || statusData.agent_name;
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    agentName,
    gateway,
    stats,
    models,
    cronJobs,
    channels,
    pipeline,
    features,
    health,
  };

  // Redact the entire payload before returning
  return redact(summary);
}

module.exports = { collectAll };
