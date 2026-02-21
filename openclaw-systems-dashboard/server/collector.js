'use strict';

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Cache = require('./cache');
const { redact } = require('./redactor');

const COMMAND_TIMEOUT = 10_000; // 10 s per CLI call
const ACTION_TIMEOUT  = 30_000; // 30 s for mutating actions
const cache = new Cache(5000);  // 5 s TTL

// ---------------------------------------------------------------------------
// Strict allowlist of CLI commands we will ever run (read-only)
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
  doctor:       { args: ['doctor', '--json'] },
  version:      { args: ['--version'] },
  configShow:   { args: ['config', 'show', '--json'] },
  logs:         { args: ['logs', '--tail', '80'] },
  skillsList:   { args: ['skills', 'list', '--json'] },
  statusAll:    { args: ['status', '--all', '--json'] },
  statusDeep:   { args: ['status', '--deep', '--json'] },
  browserStat:  { args: ['browser', 'status'] },
  pairingPend:  { args: ['pairing', 'pending', '--json'] },
  // Model management
  modelsList:   { args: ['models', 'list', '--all', '--json'] },
  modelsStatus: { args: ['models', 'status', '--probe', '--json'] },
  modelsFallbacks: { args: ['models', 'fallbacks', 'list', '--json'] },
  // Security
  securityAudit: { args: ['security', 'audit', '--json'] },
  // Sandbox
  sandboxStatus: { args: ['sandbox', 'status', '--json'] },
  // Token usage / cost tracking
  statusUsage:  { args: ['status', '--usage', '--json'] },
  // Memory system
  memoryStat:   { args: ['memory', 'status', '--json'] },
  // Sessions
  sessionsList: { args: ['sessions', '--json'] },
  // Nodes & devices
  nodesList:    { args: ['nodes', 'list', '--json'] },
  nodesPending: { args: ['nodes', 'pending', '--json'] },
  devicesList:  { args: ['devices', 'list', '--json'] },
  // Approvals
  approvalsGet: { args: ['approvals', 'get', '--json'] },
  // System heartbeat
  heartbeatLast: { args: ['system', 'heartbeat', 'last', '--json'] },
  // Health probe (gateway)
  healthProbe:  { args: ['health', '--json', '--verbose'] },
};

// ---------------------------------------------------------------------------
// Strict allowlist of mutating actions (POST only)
// ---------------------------------------------------------------------------
const ALLOWED_ACTIONS = {
  restart:          { args: ['restart'],           description: 'Restart the OpenClaw agent' },
  gatewayRestart:   { args: ['gateway', 'restart'], description: 'Restart the gateway proxy' },
  gatewayStop:      { args: ['gateway', 'stop'],    description: 'Stop the gateway proxy' },
  gatewayStart:     { args: ['gateway', 'start'],   description: 'Start the gateway proxy' },
  cronEnable:       { args: ['cron', 'enable'],     description: 'Enable a cron job',       acceptsId: true },
  cronDisable:      { args: ['cron', 'disable'],    description: 'Disable a cron job',      acceptsId: true },
  cronRunNow:       { args: ['cron', 'run'],        description: 'Trigger a cron job now',   acceptsId: true },
  channelReconnect: { args: ['channels', 'reconnect'], description: 'Reconnect a channel', acceptsId: true },
  resetSession:     { args: ['session', 'reset'],   description: 'Reset the current session' },
  doctor:           { args: ['doctor', '--json'],   description: 'Run diagnostic checks' },
  doctorFix:        { args: ['doctor', '--fix'],    description: 'Auto-fix common issues' },
  channelLogin:     { args: ['channels', 'login'],  description: 'Re-login to channels',   acceptsId: true },
  pairingApprove:   { args: ['pairing', 'approve'], description: 'Approve a pending pairing', acceptsId: true },
  skillInstall:     { args: ['skills', 'install'],  description: 'Install a skill from ClawHub', acceptsId: true },
  skillUninstall:   { args: ['skills', 'uninstall'], description: 'Uninstall a skill',     acceptsId: true },
  skillUpdate:      { args: ['skills', 'update', '--all'], description: 'Update all installed skills' },
  // Model management actions
  modelSet:         { args: ['models', 'set'],               description: 'Set the primary AI model', acceptsId: true },
  modelFallbackAdd: { args: ['models', 'fallbacks', 'add'],  description: 'Add a fallback model',     acceptsId: true },
  modelFallbackRm:  { args: ['models', 'fallbacks', 'remove'], description: 'Remove a fallback model', acceptsId: true },
  modelAliasAdd:    { args: ['models', 'aliases', 'add'],    description: 'Add a model alias',        acceptsId: true },
  // Security actions
  securityAuditFix: { args: ['security', 'audit', '--deep', '--fix'], description: 'Run deep security audit with auto-fix' },
  // Sandbox actions
  sandboxEnable:    { args: ['sandbox', 'enable'],           description: 'Enable sandbox mode' },
  sandboxDisable:   { args: ['sandbox', 'disable'],          description: 'Disable sandbox mode' },
  // Memory actions
  memoryIndex:      { args: ['memory', 'index'],             description: 'Rebuild the memory index' },
  // Node/device management
  nodeApprove:      { args: ['nodes', 'approve'],            description: 'Approve a pending node',    acceptsId: true },
  deviceRevoke:     { args: ['devices', 'revoke'],           description: 'Revoke a device token',     acceptsId: true },
  // Heartbeat
  heartbeatEnable:  { args: ['system', 'heartbeat', 'enable'], description: 'Enable system heartbeat' },
  heartbeatDisable: { args: ['system', 'heartbeat', 'disable'], description: 'Disable system heartbeat' },
  // Session management
  sessionReset:     { args: ['reset', '--scope', 'sessions'], description: 'Reset all sessions' },
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
// Skills builder
// ---------------------------------------------------------------------------
function buildSkills(skillsData) {
  if (!skillsData || skillsData._error) return [];
  const skills = Array.isArray(skillsData) ? skillsData : (skillsData.skills || []);
  return skills.map((s) => ({
    name: s.name || s.slug || 'Unknown',
    slug: s.slug || s.name || '',
    description: s.description || '',
    enabled: s.enabled !== false,
    version: s.version || null,
    source: s.source || s.origin || null,
  }));
}

// ---------------------------------------------------------------------------
// Pending pairings builder
// ---------------------------------------------------------------------------
function buildPairings(pairingData) {
  if (!pairingData || pairingData._error) return [];
  const pairings = Array.isArray(pairingData) ? pairingData : (pairingData.pairings || pairingData.pending || []);
  return pairings.map((p) => ({
    id: p.id || p.chatId || p.chat_id || '',
    channel: p.channel || p.type || 'Unknown',
    name: p.name || p.displayName || p.from || '',
    requestedAt: p.requestedAt || p.created_at || null,
  }));
}

// ---------------------------------------------------------------------------
// Model management builder (detailed model info with fallbacks & probing)
// ---------------------------------------------------------------------------
function buildModelManagement(modelsData, fallbacksData, probeData) {
  const models = [];
  if (modelsData && !modelsData._error) {
    const list = Array.isArray(modelsData) ? modelsData : (modelsData.models || []);
    for (const m of list) {
      models.push({
        id: m.id || m.model || m.name || '',
        displayName: m.displayName || m.display_name || m.model || m.name || '',
        provider: m.provider || m.vendor || '',
        primary: !!m.primary,
        enabled: m.enabled !== false,
        auth: m.auth || m.auth_type || '',
        contextWindow: m.contextWindow || m.context_window || null,
        maxTokens: m.maxTokens || m.max_tokens || null,
      });
    }
  }

  const fallbacks = [];
  if (fallbacksData && !fallbacksData._error) {
    const list = Array.isArray(fallbacksData) ? fallbacksData : (fallbacksData.fallbacks || []);
    for (const f of list) {
      fallbacks.push({
        model: f.model || f.name || f.id || '',
        priority: f.priority || f.order || 0,
      });
    }
  }

  // Probe results (model health/latency)
  const probeResults = [];
  if (probeData && !probeData._error) {
    const list = Array.isArray(probeData) ? probeData : (probeData.results || probeData.models || []);
    for (const p of list) {
      probeResults.push({
        model: p.model || p.name || p.id || '',
        reachable: p.reachable !== false && p.ok !== false && p.status !== 'down',
        latencyMs: p.latencyMs || p.latency_ms || p.latency || null,
        error: p.error || null,
      });
    }
  }

  return { models, fallbacks, probeResults };
}

// ---------------------------------------------------------------------------
// Security audit builder
// ---------------------------------------------------------------------------
function buildSecurityAudit(auditData) {
  if (!auditData || auditData._error) return null;

  const checks = Array.isArray(auditData) ? auditData : (auditData.checks || auditData.results || auditData.findings || []);
  const summary = auditData.summary || {};

  let passed = 0;
  let warnings = 0;
  let critical = 0;
  const items = [];

  for (const c of checks) {
    const severity = (c.severity || c.level || 'info').toLowerCase();
    const ok = c.ok !== false && c.pass !== false && c.status !== 'fail' && severity !== 'critical';
    if (ok) passed++;
    else if (severity === 'critical' || severity === 'high') critical++;
    else warnings++;
    items.push({
      name: c.name || c.check || c.title || 'Check',
      ok,
      severity,
      detail: c.message || c.detail || c.description || '',
      fixable: !!c.fixable,
    });
  }

  return {
    passed: summary.passed || passed,
    warnings: summary.warnings || warnings,
    critical: summary.critical || critical,
    total: items.length,
    items,
    lastRun: auditData.timestamp || auditData.runAt || new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Sandbox status builder
// ---------------------------------------------------------------------------
function buildSandboxStatus(sandboxData) {
  if (!sandboxData || sandboxData._error) return null;

  return {
    enabled: !!sandboxData.enabled,
    mode: sandboxData.mode || sandboxData.sandbox_mode || 'unknown',
    scope: sandboxData.scope || 'unknown',
    dockerEnabled: sandboxData.docker !== false && sandboxData.dockerEnabled !== false,
    dockerImage: sandboxData.dockerImage || sandboxData.docker_image || null,
    networkAccess: sandboxData.networkAccess !== false,
    fileSystemAccess: sandboxData.fileSystemAccess || sandboxData.fs_access || 'restricted',
  };
}

// ---------------------------------------------------------------------------
// Browser status builder
// ---------------------------------------------------------------------------
function buildBrowserStatus(browserData) {
  if (!browserData || browserData._error) return null;
  const text = browserData._raw || JSON.stringify(browserData);
  const running = /running|active|open/i.test(text);
  const headless = /headless/i.test(text);
  const portMatch = text.match(/port[:\s]+(\d+)/i);

  return {
    running,
    headless,
    port: portMatch ? parseInt(portMatch[1], 10) : null,
    _raw: text,
  };
}

// ---------------------------------------------------------------------------
// Config builder (redact secrets, expose safe config keys)
// ---------------------------------------------------------------------------
function buildConfig(configData) {
  if (!configData || configData._error) return null;

  // Only expose non-sensitive top-level keys
  const safe = {};
  const SAFE_KEYS = [
    'agent_name', 'agentName', 'version', 'environment', 'env',
    'locale', 'timezone', 'log_level', 'logLevel', 'data_dir', 'dataDir',
    'gateway_port', 'gatewayPort', 'auto_start', 'autoStart',
    'sandbox_mode', 'sandboxMode', 'plugins', 'skills_dir', 'skillsDir',
    'cron_dir', 'cronDir', 'identity', 'theme', 'language',
  ];
  for (const key of SAFE_KEYS) {
    if (configData[key] !== undefined) {
      safe[key] = configData[key];
    }
  }

  return safe;
}

// ---------------------------------------------------------------------------
// Token usage / cost builder
// ---------------------------------------------------------------------------
function buildTokenUsage(usageData) {
  if (!usageData || usageData._error) return null;
  const providers = usageData.providers || usageData.usage || [];
  const providerList = Array.isArray(providers) ? providers : [];
  let totalTokens = 0;
  let totalCost = 0;
  const breakdown = providerList.map((p) => {
    const tokens = p.tokens || p.totalTokens || p.total_tokens || 0;
    const cost = p.cost || p.totalCost || p.total_cost || 0;
    totalTokens += tokens;
    totalCost += cost;
    return {
      provider: p.provider || p.name || 'Unknown',
      model: p.model || '',
      tokens,
      cost: Math.round(cost * 100) / 100,
      inputTokens: p.inputTokens || p.input_tokens || 0,
      outputTokens: p.outputTokens || p.output_tokens || 0,
    };
  });
  return {
    totalTokens,
    totalCost: Math.round(totalCost * 100) / 100,
    breakdown,
    currency: usageData.currency || 'USD',
  };
}

// ---------------------------------------------------------------------------
// Memory status builder
// ---------------------------------------------------------------------------
function buildMemoryStatus(memData) {
  if (!memData || memData._error) return null;
  return {
    indexed: memData.indexed !== false,
    fileCount: memData.fileCount || memData.file_count || memData.files || 0,
    totalEntries: memData.totalEntries || memData.total_entries || memData.entries || 0,
    lastIndexed: memData.lastIndexed || memData.last_indexed || null,
    embeddingProvider: memData.embeddingProvider || memData.embedding_provider || null,
    searchable: memData.searchable !== false,
  };
}

// ---------------------------------------------------------------------------
// Sessions builder
// ---------------------------------------------------------------------------
function buildSessions(sessionsData) {
  if (!sessionsData || sessionsData._error) return [];
  const sessions = Array.isArray(sessionsData) ? sessionsData : (sessionsData.sessions || []);
  return sessions.slice(0, 10).map((s) => ({
    id: s.id || s.sessionId || '',
    channel: s.channel || s.type || '',
    agent: s.agent || s.agentName || '',
    startedAt: s.startedAt || s.started_at || s.created_at || null,
    messageCount: s.messageCount || s.message_count || s.messages || 0,
    active: s.active !== false,
  }));
}

// ---------------------------------------------------------------------------
// Nodes & devices builder
// ---------------------------------------------------------------------------
function buildNodes(nodesData, pendingData) {
  const nodes = [];
  if (nodesData && !nodesData._error) {
    const list = Array.isArray(nodesData) ? nodesData : (nodesData.nodes || []);
    for (const n of list) {
      nodes.push({
        id: n.id || n.nodeId || '',
        name: n.name || n.hostname || '',
        status: n.status || (n.online ? 'online' : 'offline'),
        lastSeen: n.lastSeen || n.last_seen || null,
        platform: n.platform || n.os || '',
      });
    }
  }
  const pending = [];
  if (pendingData && !pendingData._error) {
    const list = Array.isArray(pendingData) ? pendingData : (pendingData.pending || pendingData.nodes || []);
    for (const n of list) {
      pending.push({
        id: n.id || n.nodeId || '',
        name: n.name || n.hostname || '',
        requestedAt: n.requestedAt || n.created_at || null,
      });
    }
  }
  return { nodes, pending };
}

function buildDevices(devicesData) {
  if (!devicesData || devicesData._error) return [];
  const list = Array.isArray(devicesData) ? devicesData : (devicesData.devices || []);
  return list.map((d) => ({
    id: d.id || d.deviceId || '',
    name: d.name || d.label || '',
    platform: d.platform || d.os || '',
    lastActive: d.lastActive || d.last_active || null,
    current: !!d.current,
  }));
}

// ---------------------------------------------------------------------------
// Heartbeat builder
// ---------------------------------------------------------------------------
function buildHeartbeat(heartbeatData) {
  if (!heartbeatData || heartbeatData._error) return null;
  return {
    enabled: heartbeatData.enabled !== false,
    lastBeat: heartbeatData.lastBeat || heartbeatData.last_beat || heartbeatData.timestamp || null,
    interval: heartbeatData.interval || null,
    status: heartbeatData.status || (heartbeatData.enabled ? 'active' : 'disabled'),
  };
}

// ---------------------------------------------------------------------------
// System resources builder (Node.js os module — no CLI needed)
// ---------------------------------------------------------------------------
function buildSystemResources() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();

  return {
    cpu: {
      cores: cpus.length,
      model: cpus[0] ? cpus[0].model.trim() : 'Unknown',
      loadAvg1: Math.round(loadAvg[0] * 100) / 100,
      loadAvg5: Math.round(loadAvg[1] * 100) / 100,
      loadAvg15: Math.round(loadAvg[2] * 100) / 100,
    },
    memory: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usedPercent: Math.round((usedMem / totalMem) * 100),
    },
    uptime: os.uptime(),
    platform: os.platform(),
    hostname: os.hostname(),
    arch: os.arch(),
  };
}

// ---------------------------------------------------------------------------
// Cron history builder (last N runs with status tracking)
// ---------------------------------------------------------------------------
function buildCronHistory(cronRunsData) {
  if (!cronRunsData || cronRunsData._error) return [];
  const runs = Array.isArray(cronRunsData) ? cronRunsData : (cronRunsData.runs || []);
  return runs.slice(0, 50).map((r) => ({
    jobId: r.jobId || r.cronId || r.name || '',
    status: r.status || (r.exitCode === 0 ? 'ok' : 'failed'),
    exitCode: r.exitCode != null ? r.exitCode : null,
    startedAt: r.startedAt || r.started_at || r.timestamp || null,
    finishedAt: r.finishedAt || r.finished_at || null,
    durationMs: r.durationMs || r.duration_ms || r.duration || null,
    error: r.error || null,
  }));
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
    skillsData,
    pairingData,
    modelsData,
    fallbacksData,
    probeData,
    securityData,
    sandboxData,
    browserData,
    configData,
    usageData,
    memoryData,
    sessionsData,
    nodesData,
    nodesPendingData,
    devicesData,
    heartbeatData,
  ] = await Promise.all([
    runCommand('status'),
    runCommand('cronList'),
    runCommand('cronRuns'),
    runCommand('channelsList'),
    runCommand('channelsStat'),
    runCommand('agentsList'),
    runCommand('hooksList'),
    runCommand('gatewayStat'),
    runCommand('skillsList'),
    runCommand('pairingPend'),
    runCommand('modelsList'),
    runCommand('modelsFallbacks'),
    runCommand('modelsStatus'),
    runCommand('securityAudit'),
    runCommand('sandboxStatus'),
    runCommand('browserStat'),
    runCommand('configShow'),
    runCommand('statusUsage'),
    runCommand('memoryStat'),
    runCommand('sessionsList'),
    runCommand('nodesList'),
    runCommand('nodesPending'),
    runCommand('devicesList'),
    runCommand('heartbeatLast'),
  ]);

  const gateway = parseGatewayStatus(gatewayData);
  const models = buildModels(agentsData);
  const cronJobs = buildCronJobs(cronListData, cronRunsData);
  const channels = buildChannels(channelsListData, channelsStatData);
  const pipeline = buildPipeline(gateway, hooksData, channels);
  const skills = buildSkills(skillsData);
  const pendingPairings = buildPairings(pairingData);
  const modelManagement = buildModelManagement(modelsData, fallbacksData, probeData);
  const securityAudit = buildSecurityAudit(securityData);
  const sandbox = buildSandboxStatus(sandboxData);
  const browser = buildBrowserStatus(browserData);
  const config = buildConfig(configData);
  const tokenUsage = buildTokenUsage(usageData);
  const memory = buildMemoryStatus(memoryData);
  const sessions = buildSessions(sessionsData);
  const nodesInfo = buildNodes(nodesData, nodesPendingData);
  const devices = buildDevices(devicesData);
  const heartbeat = buildHeartbeat(heartbeatData);
  const systemResources = buildSystemResources();
  const cronHistory = buildCronHistory(cronRunsData);
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

  // Skills count for stats
  stats.skillsCount = skills.length || '—';

  const summary = {
    generatedAt: new Date().toISOString(),
    agentName,
    gateway,
    stats,
    models,
    cronJobs,
    channels,
    pipeline,
    skills,
    pendingPairings,
    modelManagement,
    securityAudit,
    sandbox,
    browser,
    config,
    tokenUsage,
    memory,
    sessions,
    nodes: nodesInfo,
    devices,
    heartbeat,
    systemResources,
    cronHistory,
    features,
    health,
  };

  // Redact the entire payload before returning
  return redact(summary);
}

// ---------------------------------------------------------------------------
// Execute a mutating action from the allowlist
// ---------------------------------------------------------------------------
async function executeAction(actionKey, targetId) {
  const spec = ALLOWED_ACTIONS[actionKey];
  if (!spec) {
    return { success: false, error: `Unknown action: ${actionKey}` };
  }

  const args = [...spec.args];
  if (spec.acceptsId) {
    if (!targetId || typeof targetId !== 'string' || !/^[\w\-.:]+$/.test(targetId)) {
      return { success: false, error: 'Invalid or missing target ID' };
    }
    args.push(targetId);
  }

  // Invalidate cache so the next summary fetch is fresh
  cache.clear();

  return new Promise((resolve) => {
    execFile(OPENCLAW_BIN, args, { timeout: ACTION_TIMEOUT }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[action] ${actionKey} failed: ${err.message}`);
        resolve({
          success: false,
          action: actionKey,
          error: err.message,
          stderr: (stderr || '').slice(0, 500),
        });
        return;
      }
      let output;
      try {
        output = JSON.parse(stdout);
      } catch {
        output = stdout.trim();
      }
      resolve(redact({
        success: true,
        action: actionKey,
        description: spec.description,
        output,
      }));
    });
  });
}

// ---------------------------------------------------------------------------
// Fetch recent logs (read-only, redacted)
// ---------------------------------------------------------------------------
async function fetchLogs() {
  const data = await runCommand('logs');
  if (data && data._error) {
    return { success: false, error: data.message, lines: [] };
  }
  const raw = data._raw || JSON.stringify(data);
  // Split into lines, redact each line
  const lines = raw.split('\n').map((line) => {
    // Mask anything that looks like a token/key value inline
    return line.replace(/([Tt]oken|[Kk]ey|[Ss]ecret|[Pp]assword|[Bb]earer)[=:\s]+\S+/g, '$1=[REDACTED]');
  });
  return { success: true, lines };
}

// ---------------------------------------------------------------------------
// Run diagnostics (doctor)
// ---------------------------------------------------------------------------
async function runDiagnostics() {
  cache.clear();
  const data = await runCommand('doctor');
  if (data && data._error) {
    return { success: false, error: data.message, checks: [] };
  }
  return redact({ success: true, ...data });
}

// ---------------------------------------------------------------------------
// Connection probe — quick health check to verify CLI is reachable
// ---------------------------------------------------------------------------
async function probeConnection() {
  const start = Date.now();
  const statusData = await runCommand('version');
  const latencyMs = Date.now() - start;

  if (statusData && statusData._error) {
    return {
      connected: false,
      latencyMs,
      error: statusData.message,
      binary: OPENCLAW_BIN,
    };
  }
  const version = statusData._raw || (typeof statusData === 'string' ? statusData : null);
  return {
    connected: true,
    latencyMs,
    version: version || null,
    binary: OPENCLAW_BIN,
  };
}

// ---------------------------------------------------------------------------
// List available actions (for the UI to render buttons)
// ---------------------------------------------------------------------------
function listActions() {
  const actions = {};
  for (const [key, spec] of Object.entries(ALLOWED_ACTIONS)) {
    actions[key] = {
      description: spec.description,
      requiresId: !!spec.acceptsId,
    };
  }
  return actions;
}

// ---------------------------------------------------------------------------
// Deep status — openclaw status --all / --deep
// ---------------------------------------------------------------------------
async function fetchDeepStatus() {
  cache.clear();
  const data = await runCommand('statusDeep');
  if (data && data._error) {
    // Fallback to --all
    const allData = await runCommand('statusAll');
    if (allData && allData._error) {
      return { success: false, error: allData.message };
    }
    return redact({ success: true, ...allData });
  }
  return redact({ success: true, ...data });
}

// ---------------------------------------------------------------------------
// Fetch skills list
// ---------------------------------------------------------------------------
async function fetchSkills() {
  const data = await runCommand('skillsList');
  if (data && data._error) {
    return { success: false, error: data.message, skills: [] };
  }
  return { success: true, skills: buildSkills(data) };
}

// ---------------------------------------------------------------------------
// Fetch model management details (models + fallbacks + probe)
// ---------------------------------------------------------------------------
async function fetchModelManagement() {
  cache.clear();
  const [modelsData, fallbacksData, probeData] = await Promise.all([
    runCommand('modelsList'),
    runCommand('modelsFallbacks'),
    runCommand('modelsStatus'),
  ]);
  return { success: true, ...buildModelManagement(modelsData, fallbacksData, probeData) };
}

// ---------------------------------------------------------------------------
// Run security audit
// ---------------------------------------------------------------------------
async function runSecurityAudit() {
  cache.clear();
  const data = await runCommand('securityAudit');
  if (data && data._error) {
    return { success: false, error: data.message };
  }
  const audit = buildSecurityAudit(data);
  return redact({ success: true, ...audit });
}

// ---------------------------------------------------------------------------
// Fetch sandbox status
// ---------------------------------------------------------------------------
async function fetchSandboxStatus() {
  const data = await runCommand('sandboxStatus');
  if (data && data._error) {
    return { success: false, error: data.message };
  }
  return { success: true, ...buildSandboxStatus(data) };
}

// ---------------------------------------------------------------------------
// Fetch config (safe keys only)
// ---------------------------------------------------------------------------
async function fetchConfig() {
  const data = await runCommand('configShow');
  if (data && data._error) {
    return { success: false, error: data.message };
  }
  const config = buildConfig(data);
  return redact({ success: true, config });
}

// ---------------------------------------------------------------------------
// Fetch system resources (Node.js os, no CLI)
// ---------------------------------------------------------------------------
function fetchSystemResources() {
  return { success: true, ...buildSystemResources() };
}

module.exports = {
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
};
