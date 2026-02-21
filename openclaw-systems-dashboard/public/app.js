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

  // Sections
  renderModels(d.models || []);
  renderCron(d.cronJobs || []);
  renderPipeline(d.pipeline || []);
  renderChannels(d.channels || []);
  renderSkills(d.skills || []);
  renderPairings(d.pendingPairings || []);
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

probeConnection();
refresh();
