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

// ── DOM references ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ═══════════════════════════════════════════════════════════════════
// POLLING & RENDER
// ═══════════════════════════════════════════════════════════════════

async function refresh() {
  try {
    const res = await fetch('/api/summary');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    render(data);
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
  renderModels(d.models || []);
  renderCron(d.cronJobs || []);
  renderPipeline(d.pipeline || []);
  renderGatewayDetail(d.gateway);
  renderChannels(d.channels || []);
  renderSkills(d.skills || []);
  renderPairings(d.pendingPairings || []);
  renderModelManagement(d.modelManagement || {});
  renderSecuritySummary(d.securityAudit);
  renderSandbox(d.sandbox);
  renderBrowser(d.browser);
  renderConfig(d.config);
  renderTokenUsage(d.tokenUsage);
  renderMemory(d.memory);
  renderSessions(d.sessions || []);
  renderNodesAndDevices(d.nodes, d.devices || []);
  renderHeartbeat(d.heartbeat);
  renderFeatures(d.features || []);

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
    const jobId = esc(j.name);
    const toggleBtn = j.status === 'Disabled'
      ? `<button class="btn btn-sm btn-action" onclick="runAction('cronEnable','${jobId}')" title="Enable">▶</button>`
      : `<button class="btn btn-sm btn-ghost" onclick="runAction('cronDisable','${jobId}')" title="Disable">⏸</button>`;
    const runBtn = `<button class="btn btn-sm btn-action" onclick="runAction('cronRunNow','${jobId}')" title="Run now">⚡</button>`;

    return `
      <div class="cron-item">
        <div class="cron-icon">${icon}</div>
        <div class="cron-body">
          <div class="cron-name">${jobId}</div>
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
    const name = esc(c.name);
    const statusClass = c.status === 'Down' ? 'btn-danger' : (c.status === 'Degraded' ? 'btn-warn' : '');
    return `<button class="btn btn-action ${statusClass}" onclick="runAction('channelReconnect','${name}')">↻ Reconnect ${name}</button>` +
      `<button class="btn btn-action" onclick="runAction('channelLogin','${name}')">🔑 Login ${name}</button>`;
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
    const slug = esc(s.slug || s.name);
    return `
      <div class="skill-item">
        <div class="skill-icon">${icon}</div>
        <div class="skill-body">
          <div class="skill-name">${esc(s.name)}</div>
          <div class="skill-desc">${esc(s.description)}</div>
        </div>
        <div class="skill-meta">
          ${versionTag}
          <button class="btn btn-sm btn-ghost" onclick="confirmAction('skillUninstall', 'Uninstall skill: ${slug}?', '${slug}')" title="Uninstall">✕</button>
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
    const id = esc(p.id);
    const time = p.requestedAt ? new Date(p.requestedAt).toLocaleString() : '';
    return `
      <div class="pairing-item">
        <div class="pairing-info">
          <div class="pairing-name">${esc(p.name || p.id)}</div>
          <div class="pairing-detail">${esc(p.channel)}${time ? ' · ' + esc(time) : ''}</div>
        </div>
        <button class="btn btn-action" onclick="runAction('pairingApprove','${id}')">✓ Approve</button>
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
          ${!m.primary ? `<button class="btn btn-sm btn-action" onclick="confirmAction('modelSet','Set ${esc(m.id)} as primary model?','${esc(m.id)}')" title="Set as primary">⭐</button>` : ''}
          <button class="btn btn-sm btn-ghost" onclick="confirmAction('modelFallbackAdd','Add ${esc(m.id)} to fallback chain?','${esc(m.id)}')" title="Add to fallbacks">+FB</button>
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
        <span class="fallback-remove" onclick="confirmAction('modelFallbackRm','Remove ${esc(f.model)} from fallback chain?','${esc(f.model)}')" title="Remove">✕</span>
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
    const res = await fetch('/api/models');
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
    const res = await fetch('/api/models');
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
    const res = await fetch('/api/security/audit', { method: 'POST' });
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
    const res = await fetch('/api/config');
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
          <button class="btn btn-sm btn-action" onclick="runAction('nodeApprove','${esc(n.id)}')">✓ Approve</button>
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
          ${!d.current ? `<button class="btn btn-sm btn-ghost" onclick="confirmAction('deviceRevoke','Revoke device ${esc(d.name || d.id)}?','${esc(d.id)}')" title="Revoke">✕</button>` : ''}
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
    const res = await fetch('/api/probe');
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
    const res = await fetch('/api/action', {
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
    const res = await fetch('/api/diagnose', { method: 'POST' });
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
    const res = await fetch('/api/status/deep');
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
  con.innerHTML = '<div class="output-line heading">Fetching logs…</div>';
  try {
    const res = await fetch('/api/logs');
    const d = await res.json();
    if (!d.success) {
      con.innerHTML += `<div class="output-line error">Error: ${esc(d.error)}</div>`;
      return;
    }
    const lines = d.lines || [];
    if (!lines.length) {
      con.innerHTML = '<div class="output-line warn">No log output returned.</div>';
      return;
    }
    con.innerHTML = '<div class="output-line heading">Recent Logs (' + lines.length + ' lines)</div>' +
      lines.map((l) => {
        let cls = '';
        if (/error|fatal|panic/i.test(l)) cls = 'error';
        else if (/warn/i.test(l)) cls = 'warn';
        return `<div class="output-line ${cls}">${esc(l)}</div>`;
      }).join('');
    con.scrollTop = con.scrollHeight;
  } catch (err) {
    con.innerHTML += `<div class="output-line error">Fetch error: ${esc(err.message)}</div>`;
  }
}

function clearOutput() {
  $('output-console').innerHTML = '<div class="output-placeholder">Run diagnostics or fetch logs to see output here.</div>';
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

probeConnection();
refresh();
