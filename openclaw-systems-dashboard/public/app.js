/* ===================================================================
   OpenClaw Systems Dashboard — app.js
   Polls /api/summary every POLL_INTERVAL ms, renders into the DOM.
   Adds control panel, troubleshooting, and action execution.
   =================================================================== */
'use strict';

const POLL_INTERVAL = 15_000;      // 15 s default
const MAX_BACKOFF   = 120_000;     // 2 min ceiling
const STALE_AFTER   = 3;           // show STALE after N consecutive failures

let currentInterval = POLL_INTERVAL;
let failCount = 0;
let timerId = null;
let pendingConfirmAction = null;
let lastChannelsData = [];
let rawLogLines = []; // stored for filtering

// ── DOM references ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Token-aware fetch wrapper (for remote mode) ─────────────────────
function getAuthToken() {
  return localStorage.getItem('openclaw_dashboard_token') || '';
}

function setAuthToken(token) {
  localStorage.setItem('openclaw_dashboard_token', token);
}

async function apiFetch(url, opts = {}) {
  const token = getAuthToken();
  if (token) {
    opts.headers = { ...opts.headers, 'X-Dashboard-Token': token };
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    showTokenPrompt();
    throw new Error('Unauthorized — enter your dashboard token');
  }
  return res;
}

function showTokenPrompt() {
  let overlay = $('token-prompt-overlay');
  if (overlay) { overlay.style.display = 'flex'; return; }
  overlay = document.createElement('div');
  overlay.id = 'token-prompt-overlay';
  overlay.className = 'token-prompt-overlay';
  overlay.innerHTML = `
    <div class="token-prompt">
      <h3>Dashboard Token Required</h3>
      <p>This dashboard is running in remote mode. Enter your access token:</p>
      <input type="password" id="token-input" class="token-input" placeholder="Paste DASHBOARD_TOKEN here" autocomplete="off" />
      <button id="token-submit-btn" class="btn btn-green" style="margin-top:0.75rem;width:100%">Connect</button>
    </div>
  `;
  document.body.appendChild(overlay);
  const input = $('token-input');
  const btn = $('token-submit-btn');
  btn.addEventListener('click', () => {
    const val = input.value.trim();
    if (val) { setAuthToken(val); overlay.style.display = 'none'; refresh(); }
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });
  input.focus();
}

// ═══════════════════════════════════════════════════════════════════
// POLLING & RENDER
// ═══════════════════════════════════════════════════════════════════

async function refresh() {
  try {
    const res = await apiFetch('/api/summary');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
    // Cache for optimistic UI on next page load
    try { localStorage.setItem('openclaw_cache', JSON.stringify(data)); } catch {}
    failCount = 0;
    currentInterval = POLL_INTERVAL;
    $('stale-indicator').style.display = 'none';
  } catch (err) {
    failCount++;
    console.warn('[dashboard] fetch failed (' + failCount + '):', err.message);
    if (failCount >= STALE_AFTER) {
      $('stale-indicator').style.display = 'inline-block';
    }
    currentInterval = Math.min(currentInterval * 2, MAX_BACKOFF);
  }
  scheduleNext();
}

function scheduleNext() {
  clearTimeout(timerId);
  timerId = setTimeout(refresh, currentInterval);
}

// ── Render everything ───────────────────────────────────────────────
function render(d) {
  lastDashboardData = d;
  trackActivity();
  if (d.tokenUsage) trackCostDataPoint(d.tokenUsage.totalCost);

  // Notifications (before header so they appear at top)
  renderNotifications(d);

  // Header
  $('agent-name').textContent = d.agentName || '[AGENT_NAME]';

  // Health dot
  const dot = $('health-dot');
  dot.className = 'health-dot ' + (d.health ? d.health.state : '');
  const labels = { ok: 'Healthy', warn: 'Degraded', down: 'Down' };
  $('health-label').textContent = labels[d.health?.state] || 'Unknown';

  // Stats
  $('stat-models').textContent   = d.stats?.modelsCount   ?? '—';
  $('stat-cron').textContent     = d.stats?.cronCount     ?? '—';
  $('stat-channels').textContent = d.stats?.channelsCount ?? '—';
  $('stat-skills').textContent   = d.stats?.skillsCount   ?? '—';

  // Secondary stats
  renderSecondaryStats(d);

  // Health reasons
  renderHealthReasons(d.health);

  // Sections
  renderSystemResources(d.systemResources);
  renderModels(d.models || []);
  renderCron(d.cronJobs || []);
  renderCronHistory(d.cronHistory || []);
  renderPipeline(d.pipeline || []);
  renderGatewayDetail(d.gateway);
  renderChannels(d.channels || []);
  renderSkills(d.skills || []);
  renderPairings(d.pendingPairings || []);
  renderModelManagement(d.modelManagement || {});
  renderSecuritySummary(d.securityAudit);
  renderSecurityBadge(d.securityAudit, d.sandbox);
  renderSandbox(d.sandbox);
  renderBrowser(d.browser);
  renderConfig(d.config);
  renderTokenUsage(d.tokenUsage);
  renderMemory(d.memory);
  renderSessions(d.sessions || []);
  renderNodesAndDevices(d.nodes, d.devices || []);
  renderHeartbeat(d.heartbeat);
  renderFeatures(d.features || []);
  renderActivityHeatmap();
  renderCostSparkline();

  // Keep channel data for control panel
  lastChannelsData = d.channels || [];
  renderChannelActions(lastChannelsData);

  // Timestamp
  if (d.generatedAt) {
    const t = new Date(d.generatedAt);
    $('last-updated').textContent = t.toLocaleTimeString();
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECONDARY STATS, HEALTH REASONS, GATEWAY DETAIL
// ═══════════════════════════════════════════════════════════════════

function renderSecondaryStats(d) {
  // Gateway
  const gw = d.gateway || {};
  $('stat-gateway').textContent = gw.running ? 'Running' : 'Down';
  $('stat-gateway').style.color = gw.running ? '#6ee7b7' : '#fca5a5';

  // Security
  const sec = d.securityAudit;
  if (sec && sec.total) {
    $('stat-security').textContent = sec.critical ? sec.critical + ' Issues' : 'OK';
    $('stat-security').style.color = sec.critical ? '#fca5a5' : '#6ee7b7';
  } else {
    $('stat-security').textContent = '—';
    $('stat-security').style.color = '';
  }

  // Sandbox
  const sb = d.sandbox;
  if (sb) {
    $('stat-sandbox').textContent = sb.enabled ? 'On' : 'Off';
    $('stat-sandbox').style.color = sb.enabled ? '#6ee7b7' : '#fcd34d';
  } else {
    $('stat-sandbox').textContent = '—';
    $('stat-sandbox').style.color = '';
  }

  // Browser
  const br = d.browser;
  if (br) {
    $('stat-browser').textContent = br.running ? 'Active' : 'Off';
    $('stat-browser').style.color = br.running ? '#6ee7b7' : '#9ca3af';
  } else {
    $('stat-browser').textContent = '—';
    $('stat-browser').style.color = '';
  }

  // Cost
  const tu = d.tokenUsage;
  if (tu) {
    $('stat-cost').textContent = '$' + (tu.totalCost || 0).toFixed(2);
    $('stat-cost').style.color = tu.totalCost > 10 ? '#fca5a5' : tu.totalCost > 5 ? '#fcd34d' : '#6ee7b7';
  } else {
    $('stat-cost').textContent = '—';
    $('stat-cost').style.color = '';
  }

  // Memory
  const mem = d.memory;
  if (mem) {
    $('stat-memory').textContent = mem.indexed ? mem.totalEntries || 'OK' : 'N/A';
    $('stat-memory').style.color = mem.indexed ? '#6ee7b7' : '#fcd34d';
  } else {
    $('stat-memory').textContent = '—';
    $('stat-memory').style.color = '';
  }

  // Heartbeat
  const hb = d.heartbeat;
  if (hb) {
    $('stat-heartbeat').textContent = hb.enabled ? 'Active' : 'Off';
    $('stat-heartbeat').style.color = hb.enabled ? '#6ee7b7' : '#9ca3af';
  } else {
    $('stat-heartbeat').textContent = '—';
    $('stat-heartbeat').style.color = '';
  }

  // Devices
  const devs = d.devices || [];
  $('stat-devices').textContent = devs.length || '—';
}

function renderHealthReasons(health) {
  const el = $('health-reasons');
  if (!health || !health.reasons || !health.reasons.length || health.state === 'ok') {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'flex';
  const chipClass = health.state === 'down' ? 'down' : 'warn';
  el.innerHTML = health.reasons.map((r) =>
    `<span class="health-reason-chip ${chipClass}">⚠ ${esc(r)}</span>`
  ).join('');
}

function renderGatewayDetail(gw) {
  const el = $('gateway-detail');
  if (!gw) {
    el.innerHTML = '<div class="empty-state">Gateway data unavailable</div>';
    return;
  }
  const dotClass = gw.running ? 'ok' : 'down';
  el.innerHTML = `
    <div class="gateway-status-dot ${dotClass}"></div>
    <div class="gateway-info">
      <div class="gateway-prop">
        <div class="gateway-prop-label">Status</div>
        <div class="gateway-prop-value">${gw.running ? 'Running' : 'Stopped'}</div>
      </div>
      <div class="gateway-prop">
        <div class="gateway-prop-label">Bind</div>
        <div class="gateway-prop-value">${esc(gw.bind || '—')}</div>
      </div>
      <div class="gateway-prop">
        <div class="gateway-prop-label">Port</div>
        <div class="gateway-prop-value">${gw.port || '—'}</div>
      </div>
      <div class="gateway-prop">
        <div class="gateway-prop-label">RPC</div>
        <div class="gateway-prop-value" style="color:${gw.rpcOk ? '#6ee7b7' : '#fca5a5'}">${gw.rpcOk ? 'OK' : 'N/A'}</div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// SYSTEM RESOURCES
// ═══════════════════════════════════════════════════════════════════

function renderSystemResources(res) {
  const panel = $('system-resources-panel');
  if (!res) {
    panel.innerHTML = '<div class="empty-state">System resource data unavailable</div>';
    return;
  }

  const formatBytes = (b) => {
    if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
    if (b >= 1048576) return (b / 1048576).toFixed(0) + ' MB';
    return (b / 1024).toFixed(0) + ' KB';
  };

  const formatUptime = (s) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return d + 'd ' + h + 'h';
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
  };

  const mem = res.memory || {};
  const cpu = res.cpu || {};
  const memPct = mem.usedPercent || 0;
  const memBarClass = memPct > 90 ? 'danger' : memPct > 70 ? 'warn' : 'ok';
  const loadBarPct = Math.min(100, Math.round((cpu.loadAvg1 / (cpu.cores || 1)) * 100));
  const loadBarClass = loadBarPct > 90 ? 'danger' : loadBarPct > 70 ? 'warn' : 'ok';

  panel.innerHTML = `
    <div class="sysres-card">
      <div class="sysres-card-title">CPU</div>
      <div class="sysres-stats">
        <div class="sysres-stat">
          <div class="sysres-stat-value">${cpu.cores || '—'}</div>
          <div class="sysres-stat-label">Cores</div>
        </div>
        <div class="sysres-stat">
          <div class="sysres-stat-value">${cpu.loadAvg1 || '—'}</div>
          <div class="sysres-stat-label">Load (1m)</div>
        </div>
        <div class="sysres-stat">
          <div class="sysres-stat-value">${cpu.loadAvg5 || '—'}</div>
          <div class="sysres-stat-label">Load (5m)</div>
        </div>
      </div>
      <div class="sysres-bar"><div class="sysres-bar-fill ${loadBarClass}" style="width:${loadBarPct}%"></div></div>
      <div class="sysres-meta">
        <div class="sysres-meta-item"><strong>${esc(cpu.model || '—')}</strong></div>
      </div>
    </div>
    <div class="sysres-card">
      <div class="sysres-card-title">Memory</div>
      <div class="sysres-stats">
        <div class="sysres-stat">
          <div class="sysres-stat-value">${formatBytes(mem.used || 0)}</div>
          <div class="sysres-stat-label">Used</div>
        </div>
        <div class="sysres-stat">
          <div class="sysres-stat-value">${formatBytes(mem.total || 0)}</div>
          <div class="sysres-stat-label">Total</div>
        </div>
        <div class="sysres-stat">
          <div class="sysres-stat-value">${memPct}%</div>
          <div class="sysres-stat-label">Usage</div>
        </div>
      </div>
      <div class="sysres-bar"><div class="sysres-bar-fill ${memBarClass}" style="width:${memPct}%"></div></div>
      <div class="sysres-meta">
        <div class="sysres-meta-item"><strong>${esc(res.platform || '—')}</strong> · ${esc(res.arch || '')}</div>
        <div class="sysres-meta-item">Uptime: <strong>${formatUptime(res.uptime || 0)}</strong></div>
        <div class="sysres-meta-item">Host: <strong>${esc(res.hostname || '—')}</strong></div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// CRON HISTORY
// ═══════════════════════════════════════════════════════════════════

function renderCronHistory(history) {
  const section = $('cron-history');
  const list = $('cron-history-list');
  if (!history || !history.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  list.innerHTML = history.slice(0, 20).map((r) => {
    const icon = r.status === 'ok' ? '✅' : '❌';
    const statusClass = r.status === 'ok' ? 'ok' : 'failed';
    const time = r.finishedAt ? new Date(r.finishedAt).toLocaleString() : (r.startedAt ? new Date(r.startedAt).toLocaleString() : '');
    const duration = r.durationMs ? (r.durationMs / 1000).toFixed(1) + 's' : '';
    return `
      <div class="cron-history-item">
        <div class="cron-history-icon">${icon}</div>
        <div class="cron-history-job">${esc(r.jobId)}</div>
        <div class="cron-history-status ${statusClass}">${esc(r.status)}</div>
        ${duration ? `<div class="cron-history-duration">${esc(duration)}</div>` : ''}
        <div class="cron-history-time">${esc(time)}</div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// MODELS
// ═══════════════════════════════════════════════════════════════════

function renderModels(models) {
  const grid = $('model-grid');
  if (!models.length) {
    grid.innerHTML = '<div class="empty-state">No model data available</div>';
    grid.classList.remove('has-secondary');
    return;
  }
  const primary = models.filter((m) => m.primary);
  const secondary = models.filter((m) => !m.primary);
  grid.classList.toggle('has-secondary', secondary.length > 0);
  let html = '';
  for (const m of primary) html += modelCardHTML(m, true);
  for (const m of secondary) html += modelCardHTML(m, false);
  grid.innerHTML = html;
}

function modelCardHTML(m, isPrimary) {
  const icon = modelIcon(m.alias);
  const badgeClass = 'pill pill-' + (m.badge || 'paid').toLowerCase();
  return `
    <div class="model-card${isPrimary ? ' primary' : ''}">
      <div class="model-card-icon">${icon}</div>
      <div class="model-card-body">
        <div class="model-card-name">${esc(m.displayName || m.alias)}</div>
        <div class="model-card-role">${esc(m.role || '')}</div>
      </div>
      <div class="model-card-pills">
        <span class="pill pill-alias">${esc(m.alias)}</span>
        <span class="${badgeClass}">${esc(m.badge || 'Paid')}</span>
        ${isPrimary ? '<span class="pill pill-primary-tag">PRIMARY</span>' : ''}
      </div>
    </div>`;
}

function modelIcon(alias) {
  const a = (alias || '').toLowerCase();
  if (a.includes('opus') || a.includes('claude')) return '🟣';
  if (a.includes('gpt'))   return '🟢';
  if (a.includes('kimi'))  return '🔵';
  if (a.includes('flash') || a.includes('gemini')) return '🟡';
  if (a.includes('deep'))  return '🔴';
  return '⚪';
}

// ═══════════════════════════════════════════════════════════════════
// CRON — now with inline enable/disable/run buttons
// ═══════════════════════════════════════════════════════════════════

function renderCron(jobs) {
  const list = $('cron-list');
  if (!jobs.length) {
    list.innerHTML = '<div class="empty-state">No cron jobs found</div>';
    return;
  }
  list.innerHTML = jobs.map((j) => {
    const icon = j.status === 'Active' ? '✅' : j.status === 'Disabled' ? '⏸' : j.status === 'Failed' ? '❌' : '❓';
    const lastRunLine = j.lastRun
      ? `<div class="cron-last-run">Last: ${esc(new Date(j.lastRun).toLocaleString())}</div>`
      : '';
    const jobId = jsEsc(j.name);
    const jobIdHtml = esc(j.name);
    const toggleBtn = j.status === 'Disabled'
      ? `<button class="btn btn-sm btn-action" onclick="runAction('cronEnable','${jobId}')" title="Enable">▶</button>`
      : `<button class="btn btn-sm btn-ghost" onclick="runAction('cronDisable','${jobId}')" title="Disable">⏸</button>`;
    const runBtn = `<button class="btn btn-sm btn-action" onclick="runAction('cronRunNow','${jobId}')" title="Run now">⚡</button>`;

    return `
      <div class="cron-item">
        <div class="cron-icon">${icon}</div>
        <div class="cron-body">
          <div class="cron-name">${jobIdHtml}</div>
          <div class="cron-schedule">${esc(j.schedule)}</div>
          ${lastRunLine}
        </div>
        <div class="cron-actions">${toggleBtn}${runBtn}</div>
        <div class="cron-status ${esc(j.status)}">${esc(j.status)}</div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════════════════════════════

function renderPipeline(nodes) {
  const el = $('pipeline');
  if (!nodes.length) {
    el.innerHTML = '<div class="empty-state">Pipeline data unavailable</div>';
    return;
  }
  const parts = [];
  nodes.forEach((n, i) => {
    parts.push(`
      <div class="pipeline-node" title="${esc(n.detail || '')}">
        <div class="pipeline-node-name">${esc(n.name)}</div>
        <div class="pipeline-node-state ${esc(n.state)}">${esc(n.state)}</div>
      </div>`);
    if (i < nodes.length - 1) {
      parts.push('<div class="pipeline-arrow">→</div>');
    }
  });
  el.innerHTML = parts.join('');
}

// ═══════════════════════════════════════════════════════════════════
// CHANNELS
// ═══════════════════════════════════════════════════════════════════

function renderChannels(channels) {
  const row = $('channel-row');
  if (!channels.length) {
    row.innerHTML = '<div class="empty-state">No channels found</div>';
    return;
  }
  row.innerHTML = channels.map((c) => {
    const icon = channelIcon(c.name || c.type);
    return `
      <div class="channel-chip">
        <div class="channel-chip-icon">${icon}</div>
        <div class="channel-chip-body">
          <div class="channel-chip-name">${esc(c.name)}</div>
          <div class="channel-chip-status ${esc(c.status)}">${esc(c.status)}</div>
        </div>
      </div>`;
  }).join('');
}

function channelIcon(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('telegram')) return '✈️';
  if (n.includes('discord'))  return '🎮';
  if (n.includes('slack'))    return '💼';
  if (n.includes('whatsapp')) return '📱';
  return '💬';
}

function renderChannelActions(channels) {
  const el = $('channel-actions');
  if (!el) return;
  if (!channels.length) {
    el.innerHTML = '<span class="empty-state" style="padding:0">No channels</span>';
    return;
  }
  el.innerHTML = channels.map((c) => {
    const nameJs = jsEsc(c.name);
    const nameHtml = esc(c.name);
    const statusClass = c.status === 'Down' ? 'btn-danger' : (c.status === 'Degraded' ? 'btn-warn' : '');
    return `<button class="btn btn-action ${statusClass}" onclick="runAction('channelReconnect','${nameJs}')">↻ Reconnect ${nameHtml}</button>` +
      `<button class="btn btn-action" onclick="runAction('channelLogin','${nameJs}')">🔑 Login ${nameHtml}</button>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// SKILLS
// ═══════════════════════════════════════════════════════════════════

function renderSkills(skills) {
  const list = $('skills-list');
  if (!skills.length) {
    list.innerHTML = '<div class="empty-state">No skills data available</div>';
    return;
  }
  list.innerHTML = skills.map((s) => {
    const icon = s.enabled ? '🟢' : '⚫';
    const versionTag = s.version ? `<span class="skill-version">${esc(s.version)}</span>` : '';
    const slugJs = jsEsc(s.slug || s.name);
    const slugHtml = esc(s.slug || s.name);
    return `
      <div class="skill-item">
        <div class="skill-icon">${icon}</div>
        <div class="skill-body">
          <div class="skill-name">${esc(s.name)}</div>
          <div class="skill-desc">${esc(s.description)}</div>
        </div>
        <div class="skill-meta">
          ${versionTag}
          <button class="btn btn-sm btn-ghost" onclick="confirmAction('skillUninstall', 'Uninstall skill: ${slugHtml}?', '${slugJs}')" title="Uninstall">✕</button>
        </div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// PENDING PAIRINGS
// ═══════════════════════════════════════════════════════════════════

function renderPairings(pairings) {
  const section = $('pairings-section');
  const list = $('pairings-list');
  if (!pairings.length) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';
  list.innerHTML = pairings.map((p) => {
    const idJs = jsEsc(p.id);
    const time = p.requestedAt ? new Date(p.requestedAt).toLocaleString() : '';
    return `
      <div class="pairing-item">
        <div class="pairing-info">
          <div class="pairing-name">${esc(p.name || p.id)}</div>
          <div class="pairing-detail">${esc(p.channel)}${time ? ' · ' + esc(time) : ''}</div>
        </div>
        <button class="btn btn-action" onclick="runAction('pairingApprove','${idJs}')">✓ Approve</button>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// MODEL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

function renderModelManagement(mgmt) {
  const grid = $('model-mgmt-grid');
  const fallbackSection = $('model-fallbacks');
  const fallbackList = $('fallback-list');

  const models = mgmt.models || [];
  const fallbacks = mgmt.fallbacks || [];
  const probes = mgmt.probeResults || [];

  if (!models.length) {
    grid.innerHTML = '<div class="empty-state">No detailed model data — click Refresh Models</div>';
    fallbackSection.style.display = 'none';
    return;
  }

  // Build probe lookup
  const probeMap = new Map();
  for (const p of probes) probeMap.set(p.model.toLowerCase(), p);

  grid.innerHTML = models.map((m) => {
    const probe = probeMap.get((m.id || '').toLowerCase());
    const probeHTML = probe
      ? `<span class="model-probe-status ${probe.reachable ? 'reachable' : 'unreachable'}">${probe.reachable ? '●' : '○'} ${probe.reachable ? (probe.latencyMs ? probe.latencyMs + 'ms' : 'OK') : 'Down'}</span>`
      : '';
    const metaParts = [];
    if (m.provider) metaParts.push(esc(m.provider));
    if (m.auth) metaParts.push(esc(m.auth));
    if (m.contextWindow) metaParts.push(esc(m.contextWindow) + ' ctx');
    const icon = modelIcon(m.id);

    return `
      <div class="model-mgmt-card${m.primary ? ' primary' : ''}">
        <div class="model-mgmt-icon">${icon}</div>
        <div class="model-mgmt-body">
          <div class="model-mgmt-name">${esc(m.displayName || m.id)}${m.primary ? ' <span class="pill pill-primary-tag">PRIMARY</span>' : ''}</div>
          <div class="model-mgmt-meta">${metaParts.join(' · ')}</div>
        </div>
        <div class="model-mgmt-actions">
          ${probeHTML}
          ${!m.primary ? `<button class="btn btn-sm btn-action" onclick="confirmAction('modelSet','Set ${esc(m.id)} as primary model?','${jsEsc(m.id)}')" title="Set as primary">⭐</button>` : ''}
          <button class="btn btn-sm btn-ghost" onclick="confirmAction('modelFallbackAdd','Add ${esc(m.id)} to fallback chain?','${jsEsc(m.id)}')" title="Add to fallbacks">+FB</button>
        </div>
      </div>`;
  }).join('');

  // Fallbacks
  if (fallbacks.length) {
    fallbackSection.style.display = '';
    const sorted = [...fallbacks].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const chips = sorted.map((f) =>
      `<div class="fallback-chip">
        <span>${esc(f.model)}</span>
        <span class="fallback-priority">#${f.priority || '?'}</span>
        <span class="fallback-remove" onclick="confirmAction('modelFallbackRm','Remove ${esc(f.model)} from fallback chain?','${jsEsc(f.model)}')" title="Remove">✕</span>
      </div>`
    );
    fallbackList.innerHTML = chips.join('<span class="fallback-arrow">→</span>');
  } else {
    fallbackSection.style.display = 'none';
  }
}

async function fetchModelDetails() {
  showToast('Fetching model details…', 'info');
  try {
    const res = await apiFetch('/api/models');
    const d = await res.json();
    if (d.success) {
      renderModelManagement(d);
      showToast('Model details refreshed', 'success');
    } else {
      showToast('Model fetch failed: ' + (d.error || 'unknown'), 'error');
    }
  } catch (err) {
    showToast('Model fetch error: ' + err.message, 'error');
  }
}

async function probeModels() {
  showToast('Probing model endpoints…', 'info');
  try {
    const res = await apiFetch('/api/models');
    const d = await res.json();
    if (d.success) {
      renderModelManagement(d);
      const probes = d.probeResults || [];
      const up = probes.filter((p) => p.reachable).length;
      showToast(`Probe complete: ${up}/${probes.length} models reachable`, probes.length === up ? 'success' : 'error');
    } else {
      showToast('Probe failed: ' + (d.error || 'unknown'), 'error');
    }
  } catch (err) {
    showToast('Probe error: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY AUDIT
// ═══════════════════════════════════════════════════════════════════

function renderSecuritySummary(audit) {
  const summaryEl = $('security-summary');
  const checksEl = $('security-checks');

  if (!audit) {
    summaryEl.style.display = 'none';
    checksEl.innerHTML = '<div class="empty-state">No audit data — click Run Audit</div>';
    return;
  }

  summaryEl.style.display = 'flex';
  summaryEl.innerHTML = `
    <div class="security-stat passed">
      <div class="security-stat-value">${audit.passed || 0}</div>
      <div class="security-stat-label">Passed</div>
    </div>
    <div class="security-stat warnings">
      <div class="security-stat-value">${audit.warnings || 0}</div>
      <div class="security-stat-label">Warnings</div>
    </div>
    <div class="security-stat critical">
      <div class="security-stat-value">${audit.critical || 0}</div>
      <div class="security-stat-label">Critical</div>
    </div>`;

  const items = audit.items || [];
  if (!items.length) {
    checksEl.innerHTML = '<div class="empty-state">No detailed checks available</div>';
    return;
  }

  checksEl.innerHTML = items.map((c) => {
    const icon = c.ok ? '✅' : (c.severity === 'critical' || c.severity === 'high' ? '🔴' : '⚠️');
    return `
      <div class="security-check-item">
        <div class="security-check-icon">${icon}</div>
        <div class="security-check-name">${esc(c.name)}</div>
        <div class="security-check-detail">${esc(c.detail)}</div>
        <div class="security-check-severity ${esc(c.severity)}">${esc(c.severity)}</div>
      </div>`;
  }).join('');
}

async function runSecurityAudit() {
  showToast('Running security audit…', 'info');
  try {
    const res = await apiFetch('/api/security/audit', { method: 'POST' });
    const d = await res.json();
    if (d.success) {
      renderSecuritySummary(d);
      showToast(`Audit complete: ${d.passed || 0} passed, ${d.critical || 0} critical`, d.critical ? 'error' : 'success');
    } else {
      showToast('Audit failed: ' + (d.error || 'unknown'), 'error');
    }
  } catch (err) {
    showToast('Audit error: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════
// SECURITY BADGE (HEADER)
// ═══════════════════════════════════════════════════════════════════

function renderSecurityBadge(audit, sandbox) {
  const badge = $('header-security-badge');
  const icon = $('security-badge-icon');
  const label = $('security-badge-label');
  if (!badge) return;

  let score = 0;
  let maxScore = 0;
  const issues = [];

  // Audit checks
  if (audit && audit.total) {
    maxScore += audit.total;
    score += audit.passed || 0;
    if (audit.critical) issues.push(audit.critical + ' critical');
    if (audit.warnings) issues.push(audit.warnings + ' warnings');
  }

  // Sandbox bonus
  maxScore += 1;
  if (sandbox && sandbox.enabled) {
    score += 1;
  } else {
    issues.push('sandbox off');
  }

  // Server-side security (we know these are always on)
  maxScore += 3;
  score += 3; // CSP headers, rate limiting, audit logging

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  badge.className = 'header-security-badge';
  if (audit && audit.critical) {
    badge.classList.add('critical');
    icon.textContent = '🔴';
    label.textContent = pct + '% — ' + issues[0];
  } else if (issues.length && pct < 90) {
    badge.classList.add('warnings');
    icon.textContent = '🟡';
    label.textContent = pct + '%';
  } else {
    badge.classList.add('secure');
    icon.textContent = '🟢';
    label.textContent = pct + '%';
  }

  badge.title = 'Security Score: ' + score + '/' + maxScore + (issues.length ? ' — ' + issues.join(', ') : '');
}

// ═══════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════

async function fetchAuditLog() {
  const list = $('audit-log-list');
  list.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const res = await apiFetch('/api/audit-log');
    const d = await res.json();
    if (!d.success || !d.entries || !d.entries.length) {
      list.innerHTML = '<div class="empty-state">No actions recorded yet</div>';
      return;
    }
    list.innerHTML = d.entries.map((e) => {
      const icon = e.success ? '✅' : '❌';
      const resultClass = e.success ? 'success' : 'failed';
      const time = e.timestamp ? new Date(e.timestamp).toLocaleString() : '';
      return `
        <div class="audit-entry">
          <div class="audit-entry-icon">${icon}</div>
          <div class="audit-entry-action">${esc(e.action)}</div>
          ${e.targetId ? `<div class="audit-entry-target">${esc(e.targetId)}</div>` : ''}
          <div class="audit-entry-result ${resultClass}">${e.success ? 'OK' : 'FAIL'}</div>
          ${e.error ? `<div class="audit-entry-target">${esc(e.error)}</div>` : ''}
          <div class="audit-entry-time">${esc(time)}</div>
        </div>`;
    }).join('');
    showToast('Audit log refreshed', 'success');
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error: ${esc(err.message)}</div>`;
  }
}

// ═══════════════════════════════════════════════════════════════════
// SANDBOX
// ═══════════════════════════════════════════════════════════════════

function renderSandbox(sandbox) {
  const panel = $('sandbox-panel');
  if (!sandbox) {
    panel.innerHTML = '<div class="empty-state">Sandbox data unavailable</div>';
    return;
  }

  const statusClass = sandbox.enabled ? 'enabled' : 'disabled';
  const statusText = sandbox.enabled ? 'ENABLED' : 'DISABLED';

  panel.innerHTML = `
    <div class="sandbox-header">
      <span class="sandbox-status-badge ${statusClass}">${statusText}</span>
      <span style="font-size:12px;color:#7878a0;">Sandbox isolates CLI commands for safety</span>
    </div>
    <div class="sandbox-props">
      <div class="sandbox-prop">
        <div class="sandbox-prop-label">Mode</div>
        <div class="sandbox-prop-value">${esc(sandbox.mode || '—')}</div>
      </div>
      <div class="sandbox-prop">
        <div class="sandbox-prop-label">Scope</div>
        <div class="sandbox-prop-value">${esc(sandbox.scope || '—')}</div>
      </div>
      <div class="sandbox-prop">
        <div class="sandbox-prop-label">Docker</div>
        <div class="sandbox-prop-value">${sandbox.dockerEnabled ? '✓ Enabled' : '✕ Off'}</div>
      </div>
      <div class="sandbox-prop">
        <div class="sandbox-prop-label">Docker Image</div>
        <div class="sandbox-prop-value">${esc(sandbox.dockerImage || '—')}</div>
      </div>
      <div class="sandbox-prop">
        <div class="sandbox-prop-label">Network</div>
        <div class="sandbox-prop-value">${sandbox.networkAccess ? '✓ Allowed' : '✕ Blocked'}</div>
      </div>
      <div class="sandbox-prop">
        <div class="sandbox-prop-label">File System</div>
        <div class="sandbox-prop-value">${esc(sandbox.fileSystemAccess || '—')}</div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// BROWSER STATUS
// ═══════════════════════════════════════════════════════════════════

function renderBrowser(browser) {
  const panel = $('browser-panel');
  if (!browser) {
    panel.innerHTML = '<div class="empty-state">Browser automation not detected</div>';
    return;
  }
  const dotClass = browser.running ? 'running' : 'stopped';
  const statusText = browser.running ? 'Running' : 'Stopped';
  const detailParts = [];
  if (browser.headless) detailParts.push('Headless');
  if (browser.port) detailParts.push('Port ' + browser.port);

  panel.innerHTML = `
    <div class="browser-status-dot ${dotClass}"></div>
    <div class="browser-info">
      <div class="browser-label">Browser Engine: ${statusText}</div>
      <div class="browser-detail">${detailParts.length ? esc(detailParts.join(' · ')) : 'No additional details'}</div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

function renderConfig(config) {
  const grid = $('config-grid');
  if (!config || !Object.keys(config).length) {
    grid.innerHTML = '<div class="empty-state">No configuration data — click Refresh Config</div>';
    return;
  }
  grid.innerHTML = Object.entries(config).map(([key, val]) => {
    const displayKey = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    const displayVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `
      <div class="config-item">
        <div class="config-key">${esc(displayKey)}</div>
        <div class="config-value">${esc(displayVal)}</div>
      </div>`;
  }).join('');
}

async function fetchConfigDetails() {
  showToast('Fetching configuration…', 'info');
  try {
    const res = await apiFetch('/api/config');
    const d = await res.json();
    if (d.success) {
      renderConfig(d.config);
      showToast('Configuration refreshed', 'success');
    } else {
      showToast('Config fetch failed: ' + (d.error || 'unknown'), 'error');
    }
  } catch (err) {
    showToast('Config error: ' + err.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════
// TOKEN USAGE & COST
// ═══════════════════════════════════════════════════════════════════

function renderTokenUsage(usage) {
  const panel = $('token-usage-panel');
  if (!usage) {
    panel.innerHTML = '<div class="empty-state">Token usage data unavailable</div>';
    return;
  }

  const formatTokens = (n) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);

  let html = `
    <div class="token-usage-summary">
      <div class="token-stat">
        <div>
          <div class="token-stat-value">${formatTokens(usage.totalTokens)}</div>
          <div class="token-stat-label">Total Tokens</div>
        </div>
      </div>
      <div class="token-stat">
        <div>
          <div class="token-stat-value" style="color:#fcd34d">$${usage.totalCost.toFixed(2)}</div>
          <div class="token-stat-label">Estimated Cost (${esc(usage.currency)})</div>
        </div>
      </div>
    </div>`;

  if (usage.breakdown && usage.breakdown.length) {
    html += '<div class="token-breakdown">';
    for (const p of usage.breakdown) {
      html += `
        <div class="token-provider">
          <div class="token-provider-name">${esc(p.provider)}${p.model ? ' <span style="color:#6868a0;font-weight:400">(' + esc(p.model) + ')</span>' : ''}</div>
          <div class="token-provider-cost">$${p.cost.toFixed(2)}</div>
          <div class="token-provider-tokens">${formatTokens(p.tokens)} tok</div>
        </div>`;
    }
    html += '</div>';
  }

  html += '<div class="cost-sparkline-container" id="cost-sparkline"></div>';
  panel.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════
// MEMORY
// ═══════════════════════════════════════════════════════════════════

function renderMemory(memory) {
  const panel = $('memory-panel');
  if (!memory) {
    panel.innerHTML = '<div class="empty-state">Memory system unavailable</div>';
    return;
  }
  const dotClass = memory.indexed ? 'indexed' : 'unindexed';
  const lastIndexed = memory.lastIndexed ? new Date(memory.lastIndexed).toLocaleString() : '—';
  panel.innerHTML = `
    <div class="memory-status-dot ${dotClass}"></div>
    <div class="memory-info">
      <div class="memory-prop">
        <div class="memory-prop-label">Status</div>
        <div class="memory-prop-value">${memory.indexed ? 'Indexed' : 'Not Indexed'}</div>
      </div>
      <div class="memory-prop">
        <div class="memory-prop-label">Files</div>
        <div class="memory-prop-value">${memory.fileCount || 0}</div>
      </div>
      <div class="memory-prop">
        <div class="memory-prop-label">Entries</div>
        <div class="memory-prop-value">${memory.totalEntries || 0}</div>
      </div>
      <div class="memory-prop">
        <div class="memory-prop-label">Last Indexed</div>
        <div class="memory-prop-value">${esc(lastIndexed)}</div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════════════════════

function renderSessions(sessions) {
  const list = $('sessions-list');
  if (!sessions.length) {
    list.innerHTML = '<div class="empty-state">No active sessions</div>';
    return;
  }
  list.innerHTML = sessions.map((s) => {
    const dotClass = s.active ? 'active' : 'inactive';
    const time = s.startedAt ? new Date(s.startedAt).toLocaleTimeString() : '';
    return `
      <div class="session-item">
        <div class="session-active-dot ${dotClass}"></div>
        <div class="session-channel">${esc(s.channel || '—')}</div>
        <div class="session-agent">${esc(s.agent || '—')}</div>
        <div class="session-msgs">${s.messageCount || 0} msgs</div>
        <div class="session-time">${esc(time)}</div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// NODES & DEVICES
// ═══════════════════════════════════════════════════════════════════

function renderNodesAndDevices(nodesInfo, devices) {
  const panel = $('nodes-panel');
  const nodes = nodesInfo ? nodesInfo.nodes || [] : [];
  const pending = nodesInfo ? nodesInfo.pending || [] : [];

  if (!nodes.length && !pending.length && !devices.length) {
    panel.innerHTML = '<div class="empty-state">No nodes or devices detected</div>';
    return;
  }

  let html = '';

  // Nodes
  if (nodes.length || pending.length) {
    html += '<div class="subsection-title">Nodes</div><div class="nodes-grid">';
    for (const n of nodes) {
      const dotClass = n.status === 'online' ? 'online' : 'offline';
      html += `
        <div class="node-card">
          <div class="node-status-dot ${dotClass}"></div>
          <div class="node-info">
            <div class="node-name">${esc(n.name || n.id)}</div>
            <div class="node-meta">${esc(n.platform || '')}${n.lastSeen ? ' · ' + new Date(n.lastSeen).toLocaleString() : ''}</div>
          </div>
        </div>`;
    }
    for (const n of pending) {
      html += `
        <div class="node-card">
          <div class="node-status-dot pending"></div>
          <div class="node-info">
            <div class="node-name">${esc(n.name || n.id)}</div>
            <div class="node-meta">Pending approval</div>
          </div>
          <button class="btn btn-sm btn-action" onclick="runAction('nodeApprove','${jsEsc(n.id)}')">✓ Approve</button>
        </div>`;
    }
    html += '</div>';
  }

  // Devices
  if (devices.length) {
    html += '<div class="subsection-title">Devices</div><div class="nodes-grid">';
    for (const d of devices) {
      html += `
        <div class="device-card${d.current ? ' current' : ''}">
          <div class="device-name">${esc(d.name || d.id)}${d.current ? ' <span class="pill pill-primary-tag">THIS</span>' : ''}</div>
          <div class="device-platform">${esc(d.platform || '')}</div>
          ${!d.current ? `<button class="btn btn-sm btn-ghost" onclick="confirmAction('deviceRevoke','Revoke device ${esc(d.name || d.id)}?','${jsEsc(d.id)}')" title="Revoke">✕</button>` : ''}
        </div>`;
    }
    html += '</div>';
  }

  panel.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════
// HEARTBEAT
// ═══════════════════════════════════════════════════════════════════

function renderHeartbeat(heartbeat) {
  const panel = $('heartbeat-panel');
  if (!heartbeat) {
    panel.innerHTML = '<div class="empty-state">Heartbeat data unavailable</div>';
    return;
  }
  const pulseClass = heartbeat.enabled ? 'active' : 'inactive';
  const lastBeat = heartbeat.lastBeat ? new Date(heartbeat.lastBeat).toLocaleString() : '—';
  panel.innerHTML = `
    <div class="heartbeat-pulse ${pulseClass}"></div>
    <div class="heartbeat-info">
      <div class="heartbeat-prop">
        <div class="heartbeat-prop-label">Status</div>
        <div class="heartbeat-prop-value">${heartbeat.enabled ? 'Active' : 'Disabled'}</div>
      </div>
      <div class="heartbeat-prop">
        <div class="heartbeat-prop-label">Last Beat</div>
        <div class="heartbeat-prop-value">${esc(lastBeat)}</div>
      </div>
      <div class="heartbeat-prop">
        <div class="heartbeat-prop-label">Interval</div>
        <div class="heartbeat-prop-value">${esc(heartbeat.interval || '—')}</div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════
// FEATURES
// ═══════════════════════════════════════════════════════════════════

function renderFeatures(features) {
  const grid = $('features-grid');
  if (!features.length) {
    grid.innerHTML = '<div class="empty-state">No feature data</div>';
    return;
  }
  grid.innerHTML = features.map((f) => {
    const detected = f.detected === true ? '<span class="feature-detected">DETECTED</span>' : '';
    return `
      <div class="feature-card">
        <div class="feature-card-name">${esc(f.name)}${detected}</div>
        <div class="feature-card-desc">${esc(f.description)}</div>
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// CONNECTION PROBE
// ═══════════════════════════════════════════════════════════════════

async function probeConnection() {
  const indicator = $('conn-indicator');
  const label = $('conn-label');
  const detail = $('conn-detail');
  label.textContent = 'Probing…';
  indicator.className = 'connection-indicator';

  try {
    const res = await apiFetch('/api/probe');
    const d = await res.json();
    if (d.connected) {
      indicator.className = 'connection-indicator connected';
      label.textContent = 'Connected to OpenClaw';
      detail.textContent = `${d.binary}${d.version ? ' v' + d.version : ''} · ${d.latencyMs} ms`;
    } else {
      indicator.className = 'connection-indicator disconnected';
      label.textContent = 'Disconnected';
      detail.textContent = d.error || 'CLI not reachable';
    }
  } catch (err) {
    indicator.className = 'connection-indicator disconnected';
    label.textContent = 'Probe failed';
    detail.textContent = err.message;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACTIONS — execute, confirm, toast
// ═══════════════════════════════════════════════════════════════════

async function runAction(action, targetId) {
  showToast(`Running: ${action}${targetId ? ' (' + targetId + ')' : ''}…`, 'info');
  try {
    const res = await apiFetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, targetId: targetId || undefined }),
    });
    const d = await res.json();
    if (d.success) {
      showToast(`${d.description || action} — OK`, 'success');
      // Trigger an immediate refresh after a short delay so UI reflects the change
      setTimeout(refresh, 1500);
    } else {
      showToast(`${action} failed: ${d.error}`, 'error');
    }
  } catch (err) {
    showToast(`${action} error: ${err.message}`, 'error');
  }
}

let pendingConfirmTargetId = null;

function confirmAction(action, message, targetId) {
  pendingConfirmAction = action;
  pendingConfirmTargetId = targetId || null;
  $('confirm-message').textContent = message;
  $('confirm-overlay').style.display = 'flex';
}

function cancelConfirm() {
  pendingConfirmAction = null;
  pendingConfirmTargetId = null;
  $('confirm-overlay').style.display = 'none';
}

function executeConfirmed() {
  const action = pendingConfirmAction;
  const target = pendingConfirmTargetId;
  cancelConfirm();
  if (action) runAction(action, target);
}

// ═══════════════════════════════════════════════════════════════════
// TROUBLESHOOT — diagnostics + logs
// ═══════════════════════════════════════════════════════════════════

async function runDiagnostics() {
  const con = $('output-console');
  con.innerHTML = '<div class="output-line heading">Running diagnostics…</div>';
  try {
    const res = await apiFetch('/api/diagnose', { method: 'POST' });
    const d = await res.json();
    if (!d.success) {
      con.innerHTML += `<div class="output-line error">Error: ${esc(d.error)}</div>`;
      return;
    }
    // Render checks if present
    const checks = d.checks || d.results || [];
    if (Array.isArray(checks) && checks.length) {
      let html = '<div class="output-line heading">Diagnostic Results</div>';
      for (const c of checks) {
        const icon = c.ok || c.pass || c.status === 'ok' ? '✅' : '❌';
        const name = c.name || c.check || 'Check';
        const detail = c.message || c.detail || c.error || '';
        const cls = c.ok || c.pass || c.status === 'ok' ? 'success' : 'error';
        html += `<div class="diag-check"><span class="diag-icon">${icon}</span><span class="diag-name">${esc(name)}</span><span class="diag-detail ${cls}">${esc(detail)}</span></div>`;
      }
      con.innerHTML = html;
    } else {
      // Raw output
      const raw = typeof d.output === 'string' ? d.output : JSON.stringify(d, null, 2);
      con.innerHTML = `<div class="output-line heading">Diagnostic Output</div>` +
        raw.split('\n').map((l) => `<div class="output-line">${esc(l)}</div>`).join('');
    }
  } catch (err) {
    con.innerHTML += `<div class="output-line error">Fetch error: ${esc(err.message)}</div>`;
  }
}

async function fetchDeepStatus() {
  const con = $('output-console');
  con.innerHTML = '<div class="output-line heading">Fetching deep status…</div>';
  try {
    const res = await apiFetch('/api/status/deep');
    const d = await res.json();
    if (!d.success) {
      con.innerHTML += `<div class="output-line error">Error: ${esc(d.error)}</div>`;
      return;
    }
    const raw = JSON.stringify(d, null, 2);
    con.innerHTML = '<div class="output-line heading">Deep Status Report</div>' +
      raw.split('\n').map((l) => {
        let cls = '';
        if (/error|fail|down/i.test(l)) cls = 'error';
        else if (/warn|degraded/i.test(l)) cls = 'warn';
        else if (/ok|healthy|running|active|true/i.test(l)) cls = 'success';
        return `<div class="output-line ${cls}">${esc(l)}</div>`;
      }).join('');
  } catch (err) {
    con.innerHTML += `<div class="output-line error">Fetch error: ${esc(err.message)}</div>`;
  }
}

async function fetchLogs() {
  const con = $('output-console');
  const filterBar = $('log-filter-bar');
  con.innerHTML = '<div class="output-line heading">Fetching logs…</div>';
  try {
    const res = await apiFetch('/api/logs');
    const d = await res.json();
    if (!d.success) {
      con.innerHTML += `<div class="output-line error">Error: ${esc(d.error)}</div>`;
      if (filterBar) filterBar.style.display = 'none';
      return;
    }
    const lines = d.lines || [];
    if (!lines.length) {
      con.innerHTML = '<div class="output-line warn">No log output returned.</div>';
      if (filterBar) filterBar.style.display = 'none';
      return;
    }
    rawLogLines = lines;
    con.innerHTML = '<div class="output-line heading">Recent Logs (' + lines.length + ' lines)</div>' +
      lines.map((l) => {
        let cls = '';
        if (/error|fatal|panic/i.test(l)) cls = 'error';
        else if (/warn/i.test(l)) cls = 'warn';
        return `<div class="output-line ${cls}">${esc(l)}</div>`;
      }).join('');
    con.scrollTop = con.scrollHeight;
    // Show filter bar
    if (filterBar) {
      filterBar.style.display = 'flex';
      if ($('log-search')) $('log-search').value = '';
      filterLogs();
    }
  } catch (err) {
    con.innerHTML += `<div class="output-line error">Fetch error: ${esc(err.message)}</div>`;
  }
}

function clearOutput() {
  $('output-console').innerHTML = '<div class="output-placeholder">Run diagnostics or fetch logs to see output here.</div>';
  const filterBar = $('log-filter-bar');
  if (filterBar) filterBar.style.display = 'none';
  rawLogLines = [];
}

// ═══════════════════════════════════════════════════════════════════
// TOASTS
// ═══════════════════════════════════════════════════════════════════

function showToast(message, type) {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast ' + (type || 'info');
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function esc(s) {
  if (s == null) return '';
  const el = document.createElement('span');
  el.textContent = String(s);
  return el.innerHTML;
}

/** Escape a value for safe use inside JS string literals in onclick handlers */
function jsEsc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// ═══════════════════════════════════════════════════════════════════
// NOTIFICATION CENTER
// ═══════════════════════════════════════════════════════════════════

let notificationsDismissed = false;
let lastDashboardData = null;

function buildNotifications(d) {
  const alerts = [];
  const now = new Date().toLocaleTimeString();

  // Security critical issues
  if (d.securityAudit && d.securityAudit.critical > 0) {
    alerts.push({ level: 'critical', icon: '🔴', text: d.securityAudit.critical + ' critical security issue(s) found — run Deep Audit + Fix', time: now });
  }

  // Gateway down
  if (d.gateway && !d.gateway.running) {
    alerts.push({ level: 'critical', icon: '🌐', text: 'Gateway is not running — services may be unreachable', time: now });
  }

  // Sandbox disabled
  if (d.sandbox && !d.sandbox.enabled) {
    alerts.push({ level: 'warning', icon: '📦', text: 'Sandbox is disabled — commands run without isolation', time: now });
  }

  // Failed cron jobs
  const failedCrons = (d.cronJobs || []).filter((j) => j.status === 'Failed');
  if (failedCrons.length) {
    alerts.push({ level: 'warning', icon: '⏱', text: failedCrons.length + ' cron job(s) failed: ' + failedCrons.map((j) => j.name).join(', '), time: now });
  }

  // Down channels
  const downChannels = (d.channels || []).filter((c) => c.status === 'Down');
  if (downChannels.length) {
    alerts.push({ level: 'warning', icon: '📡', text: downChannels.length + ' channel(s) down: ' + downChannels.map((c) => c.name).join(', '), time: now });
  }

  // High memory usage (system resources)
  if (d.systemResources && d.systemResources.memory && d.systemResources.memory.usedPercent > 90) {
    alerts.push({ level: 'warning', icon: '💻', text: 'System memory usage at ' + d.systemResources.memory.usedPercent + '%', time: now });
  }

  // High cost alert
  if (d.tokenUsage && d.tokenUsage.totalCost > 10) {
    alerts.push({ level: 'info', icon: '💰', text: 'Token spend has reached $' + d.tokenUsage.totalCost.toFixed(2), time: now });
  }

  return alerts;
}

function renderNotifications(d) {
  if (notificationsDismissed) return;
  const alerts = buildNotifications(d);
  const center = $('notification-center');
  const list = $('notification-list');
  const count = $('notification-count');

  if (!alerts.length) {
    center.style.display = 'none';
    return;
  }

  center.style.display = '';
  count.textContent = alerts.length;
  list.innerHTML = alerts.map((a) => `
    <div class="notification-item ${esc(a.level)}">
      <div class="notification-item-icon">${a.icon}</div>
      <div class="notification-item-text">${esc(a.text)}</div>
      <div class="notification-item-time">${esc(a.time)}</div>
    </div>
  `).join('');
}

function dismissNotifications() {
  notificationsDismissed = true;
  $('notification-center').style.display = 'none';
  // Reset after 2 minutes so new alerts can show
  setTimeout(() => { notificationsDismissed = false; }, 120_000);
}

// ═══════════════════════════════════════════════════════════════════
// DATA EXPORT
// ═══════════════════════════════════════════════════════════════════

function exportDashboardData() {
  const data = lastDashboardData;
  if (!data) {
    showToast('No dashboard data to export', 'error');
    return;
  }
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    dashboard: data,
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'openclaw-dashboard-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Dashboard data exported', 'success');
}

// ═══════════════════════════════════════════════════════════════════
// THEME TOGGLE
// ═══════════════════════════════════════════════════════════════════

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('openclaw_theme', next); } catch {}
  $('theme-toggle').textContent = next === 'light' ? '☀️' : '🌙';
}

function restoreTheme() {
  try {
    const saved = localStorage.getItem('openclaw_theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      $('theme-toggle').textContent = '☀️';
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTIONS
// ═══════════════════════════════════════════════════════════════════

function toggleSection(titleEl) {
  const section = titleEl.closest('.section');
  if (!section) return;
  const key = section.getAttribute('data-section');
  const collapsed = section.classList.toggle('collapsed');
  if (key) {
    try {
      const state = JSON.parse(localStorage.getItem('openclaw_collapsed') || '{}');
      state[key] = collapsed;
      localStorage.setItem('openclaw_collapsed', JSON.stringify(state));
    } catch {}
  }
}

function restoreCollapsedSections() {
  try {
    const state = JSON.parse(localStorage.getItem('openclaw_collapsed') || '{}');
    for (const [key, collapsed] of Object.entries(state)) {
      if (collapsed) {
        const el = document.querySelector(`[data-section="${key}"]`);
        if (el) el.classList.add('collapsed');
      }
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// LOG FILTERING
// ═══════════════════════════════════════════════════════════════════

function filterLogs() {
  const search = ($('log-search') ? $('log-search').value : '').toLowerCase();
  const checkboxes = document.querySelectorAll('.log-level-checkbox input');
  const levels = {};
  checkboxes.forEach((cb) => { levels[cb.getAttribute('data-level')] = cb.checked; });

  const lines = document.querySelectorAll('#output-console .output-line:not(.heading)');
  let visible = 0;
  lines.forEach((line) => {
    const text = line.textContent.toLowerCase();
    const isError = line.classList.contains('error');
    const isWarn = line.classList.contains('warn');
    const isInfo = !isError && !isWarn;

    let levelOk = true;
    if (isError && !levels.error) levelOk = false;
    if (isWarn && !levels.warn) levelOk = false;
    if (isInfo && !levels.info) levelOk = false;

    const searchOk = !search || text.includes(search);
    const show = levelOk && searchOk;
    line.classList.toggle('filtered-out', !show);
    if (show) visible++;
  });

  const countEl = $('log-count');
  if (countEl) countEl.textContent = visible + '/' + lines.length;
}

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY HEATMAP
// ═══════════════════════════════════════════════════════════════════

function trackActivity() {
  const key = new Date().toISOString().slice(0, 10);
  try {
    const data = JSON.parse(localStorage.getItem('openclaw_activity') || '{}');
    data[key] = (data[key] || 0) + 1;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 91);
    const cutoffKey = cutoff.toISOString().slice(0, 10);
    for (const k of Object.keys(data)) {
      if (k < cutoffKey) delete data[k];
    }
    localStorage.setItem('openclaw_activity', JSON.stringify(data));
  } catch {}
}

function renderActivityHeatmap() {
  const container = $('heatmap-grid');
  if (!container) return;
  let data = {};
  try { data = JSON.parse(localStorage.getItem('openclaw_activity') || '{}'); } catch {}

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weeks = 13;

  // Start from the Sunday N weeks ago
  const start = new Date(today);
  start.setDate(start.getDate() - start.getDay() - (weeks - 1) * 7);

  // Gather all counts for color scaling
  const counts = [];
  const tmp = new Date(start);
  for (let i = 0; i < weeks * 7; i++) {
    counts.push(data[tmp.toISOString().slice(0, 10)] || 0);
    tmp.setDate(tmp.getDate() + 1);
  }
  const maxVal = Math.max(1, ...counts);

  let html = '<div class="heatmap-day-labels"><span></span><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span></div>';
  html += '<div class="heatmap-columns">';
  const cell = new Date(start);
  for (let w = 0; w < weeks; w++) {
    html += '<div class="heatmap-col">';
    for (let d = 0; d < 7; d++) {
      const dateKey = cell.toISOString().slice(0, 10);
      const count = data[dateKey] || 0;
      const future = cell > today;
      let level = 0;
      if (!future && count > 0) {
        const ratio = count / maxVal;
        level = ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4;
      }
      const cls = future ? 'heatmap-cell future' : 'heatmap-cell level-' + level;
      const tip = future ? '' : dateKey + ': ' + count + ' interaction' + (count !== 1 ? 's' : '');
      html += '<div class="' + cls + '" title="' + tip + '"></div>';
      cell.setDate(cell.getDate() + 1);
    }
    html += '</div>';
  }
  html += '</div>';

  const total = counts.reduce((a, b) => a + b, 0);
  const active = counts.filter(c => c > 0).length;
  html += '<div class="heatmap-summary">' + total + ' interactions over ' + active + ' active day' + (active !== 1 ? 's' : '') + '</div>';
  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════
// COST TREND SPARKLINE
// ═══════════════════════════════════════════════════════════════════

function trackCostDataPoint(cost) {
  if (typeof cost !== 'number') return;
  try {
    const points = JSON.parse(localStorage.getItem('openclaw_cost_trend') || '[]');
    const now = Date.now();
    points.push({ t: now, v: cost });
    // Keep last 100 points, only last 24h
    const cutoff = now - 86400000;
    const filtered = points.filter(p => p.t > cutoff).slice(-100);
    localStorage.setItem('openclaw_cost_trend', JSON.stringify(filtered));
  } catch {}
}

function renderCostSparkline() {
  const container = $('cost-sparkline');
  if (!container) return;

  let points = [];
  try { points = JSON.parse(localStorage.getItem('openclaw_cost_trend') || '[]'); } catch {}
  if (points.length < 2) {
    container.innerHTML = '<span class="sparkline-empty">Collecting cost data\u2026</span>';
    return;
  }

  const values = points.map(p => p.v);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const stepX = w / (values.length - 1);
  const pathPoints = values.map((v, i) => {
    const x = Math.round(i * stepX * 10) / 10;
    const y = Math.round((h - ((v - min) / range) * (h - 4) - 2) * 10) / 10;
    return x + ',' + y;
  });

  const pathD = 'M' + pathPoints.join(' L');
  const areaD = pathD + ' L' + w + ',' + h + ' L0,' + h + ' Z';

  const latest = values[values.length - 1];
  const prev = values[values.length - 2];
  const trend = latest > prev ? 'up' : latest < prev ? 'down' : 'flat';
  const trendIcon = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2192';
  const trendClass = trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-flat';

  container.innerHTML =
    '<div class="sparkline-chart">' +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">' +
        '<path d="' + areaD + '" class="sparkline-area"/>' +
        '<path d="' + pathD + '" class="sparkline-line" fill="none"/>' +
      '</svg>' +
    '</div>' +
    '<span class="sparkline-trend ' + trendClass + '">' + trendIcon + ' $' + latest.toFixed(2) + '</span>';
}

// ═══════════════════════════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════════════════

const SECTION_SHORTCUTS = {
  '1': 'system-resources',
  '2': 'model-stack',
  '3': 'cron-jobs',
  '4': 'pipeline',
  '5': 'gateway',
  '6': 'channels',
  '7': 'skills',
  '8': 'security',
  '9': 'token-usage',
};

function handleKeyboardShortcuts(e) {
  // Ignore when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  // Ignore if confirm modal is open
  if ($('confirm-overlay').style.display === 'flex') return;

  const key = e.key;
  const ctrlOrMeta = e.ctrlKey || e.metaKey;

  // Command palette: Ctrl+K / Cmd+K
  if (ctrlOrMeta && key === 'k') {
    e.preventDefault();
    toggleCommandPalette();
    return;
  }

  // If command palette is open, don't process other shortcuts
  if ($('command-palette').style.display === 'flex') return;

  // Shortcuts help: ?
  if (key === '?') {
    e.preventDefault();
    toggleShortcutsHelp();
    return;
  }

  // Escape closes open panels
  if (key === 'Escape') {
    if ($('shortcuts-panel').style.display === 'flex') {
      $('shortcuts-panel').style.display = 'none';
    }
    return;
  }

  // Refresh: r
  if (key === 'r') {
    e.preventDefault();
    refresh();
    showToast('Refreshing dashboard\u2026', 'info');
    return;
  }

  // Toggle theme: Shift+T
  if (key === 'T') {
    e.preventDefault();
    toggleTheme();
    return;
  }

  // Export: Shift+E
  if (key === 'E') {
    e.preventDefault();
    exportDashboardData();
    return;
  }

  // Focus log search: /
  if (key === '/') {
    const searchInput = $('log-search');
    if (searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    return;
  }

  // Number keys: jump to section
  if (SECTION_SHORTCUTS[key]) {
    e.preventDefault();
    scrollToSection(SECTION_SHORTCUTS[key]);
    return;
  }
}

function toggleShortcutsHelp() {
  const panel = $('shortcuts-panel');
  panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
}

// ═══════════════════════════════════════════════════════════════════
// COMMAND PALETTE
// ═══════════════════════════════════════════════════════════════════

const PALETTE_COMMANDS = [
  { name: 'Refresh Dashboard', action: function() { refresh(); showToast('Refreshing\u2026', 'info'); }, keys: 'r', category: 'General' },
  { name: 'Toggle Theme', action: function() { toggleTheme(); }, keys: 'Shift+T', category: 'General' },
  { name: 'Export Data', action: function() { exportDashboardData(); }, keys: 'Shift+E', category: 'General' },
  { name: 'Keyboard Shortcuts', action: function() { toggleShortcutsHelp(); }, keys: '?', category: 'General' },
  { name: 'Run Health Check', action: function() { runDiagnostics(); }, category: 'Actions' },
  { name: 'Run Security Audit', action: function() { runSecurityAudit(); }, category: 'Actions' },
  { name: 'Probe All Models', action: function() { probeModels(); }, category: 'Actions' },
  { name: 'Fetch Logs', action: function() { fetchLogs(); }, category: 'Actions' },
  { name: 'Deep Status', action: function() { fetchDeepStatus(); }, category: 'Actions' },
  { name: 'Refresh Config', action: function() { fetchConfigDetails(); }, category: 'Actions' },
  { name: 'Refresh Models', action: function() { fetchModelDetails(); }, category: 'Actions' },
  { name: 'Refresh Audit Log', action: function() { fetchAuditLog(); }, category: 'Actions' },
  { name: 'Go to System Resources', action: function() { scrollToSection('system-resources'); }, keys: '1', category: 'Navigate' },
  { name: 'Go to AI Models', action: function() { scrollToSection('model-stack'); }, keys: '2', category: 'Navigate' },
  { name: 'Go to Cron Jobs', action: function() { scrollToSection('cron-jobs'); }, keys: '3', category: 'Navigate' },
  { name: 'Go to Pipeline', action: function() { scrollToSection('pipeline'); }, keys: '4', category: 'Navigate' },
  { name: 'Go to Gateway', action: function() { scrollToSection('gateway'); }, keys: '5', category: 'Navigate' },
  { name: 'Go to Channels', action: function() { scrollToSection('channels'); }, keys: '6', category: 'Navigate' },
  { name: 'Go to Skills', action: function() { scrollToSection('skills'); }, keys: '7', category: 'Navigate' },
  { name: 'Go to Security', action: function() { scrollToSection('security'); }, keys: '8', category: 'Navigate' },
  { name: 'Go to Token Usage', action: function() { scrollToSection('token-usage'); }, keys: '9', category: 'Navigate' },
  { name: 'Go to Memory', action: function() { scrollToSection('memory'); }, category: 'Navigate' },
  { name: 'Go to Sessions', action: function() { scrollToSection('sessions'); }, category: 'Navigate' },
  { name: 'Go to Nodes & Devices', action: function() { scrollToSection('nodes-devices'); }, category: 'Navigate' },
  { name: 'Go to Heartbeat', action: function() { scrollToSection('heartbeat'); }, category: 'Navigate' },
  { name: 'Go to Activity Heatmap', action: function() { scrollToSection('activity'); }, category: 'Navigate' },
];

function scrollToSection(sectionKey) {
  const section = document.querySelector('[data-section="' + sectionKey + '"]');
  if (section) {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (section.classList.contains('collapsed')) {
      section.classList.remove('collapsed');
    }
  }
}

function toggleCommandPalette() {
  const palette = $('command-palette');
  if (palette.style.display === 'flex') {
    closeCommandPalette();
  } else {
    openCommandPalette();
  }
}

function openCommandPalette() {
  const palette = $('command-palette');
  palette.style.display = 'flex';
  const input = $('palette-search');
  input.value = '';
  filterCommandPalette();
  setTimeout(function() { input.focus(); }, 50);
}

function closeCommandPalette() {
  $('command-palette').style.display = 'none';
}

function filterCommandPalette() {
  const query = ($('palette-search').value || '').toLowerCase();
  const list = $('palette-results');
  const filtered = query
    ? PALETTE_COMMANDS.filter(function(c) { return c.name.toLowerCase().includes(query) || c.category.toLowerCase().includes(query); })
    : PALETTE_COMMANDS;

  if (!filtered.length) {
    list.innerHTML = '<div class="palette-empty">No matching commands</div>';
    return;
  }

  let lastCategory = '';
  let html = '';
  for (const cmd of filtered) {
    if (cmd.category !== lastCategory) {
      lastCategory = cmd.category;
      html += '<div class="palette-category">' + esc(cmd.category) + '</div>';
    }
    const idx = PALETTE_COMMANDS.indexOf(cmd);
    html += '<div class="palette-item" data-idx="' + idx + '" onclick="executePaletteCommand(' + idx + ')">';
    html += '<span class="palette-item-name">' + esc(cmd.name) + '</span>';
    if (cmd.keys) html += '<span class="palette-item-keys">' + esc(cmd.keys) + '</span>';
    html += '</div>';
  }
  list.innerHTML = html;
}

function executePaletteCommand(idx) {
  closeCommandPalette();
  const cmd = PALETTE_COMMANDS[idx];
  if (cmd && cmd.action) cmd.action();
}

function handlePaletteKey(e) {
  if (e.key === 'Escape') {
    closeCommandPalette();
    e.stopPropagation();
  } else if (e.key === 'Enter') {
    const first = document.querySelector('.palette-item');
    if (first) {
      const idx = parseInt(first.getAttribute('data-idx'), 10);
      executePaletteCommand(idx);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════

// Keyboard support for quick action cards
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('quick-action-card')) {
    e.preventDefault();
    e.target.click();
  }
});

// Restore persisted state
restoreTheme();
restoreCollapsedSections();

// Optimistic UI: show cached data immediately
try {
  const cached = localStorage.getItem('openclaw_cache');
  if (cached) {
    const data = JSON.parse(cached);
    render(data);
  }
} catch {}

// Keyboard shortcuts
document.addEventListener('keydown', handleKeyboardShortcuts);

probeConnection();
refresh();
