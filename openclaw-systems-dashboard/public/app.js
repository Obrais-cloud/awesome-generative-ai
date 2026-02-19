/* ===================================================================
   OpenClaw Systems Dashboard — app.js
   Polls /api/summary every POLL_INTERVAL ms, renders into the DOM.
   =================================================================== */
'use strict';

const POLL_INTERVAL = 15_000;      // 15 s default
const MAX_BACKOFF   = 120_000;     // 2 min ceiling
const STALE_AFTER   = 3;           // show STALE after N consecutive failures

let currentInterval = POLL_INTERVAL;
let failCount = 0;
let timerId = null;

// ── DOM references ──────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

// ── Fetch & render loop ─────────────────────────────────────────────
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
    // Exponential backoff: double interval, cap at MAX_BACKOFF
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
  $('stat-session').textContent  = d.stats?.sessionLife   ?? '—';

  // Models
  renderModels(d.models || []);

  // Cron
  renderCron(d.cronJobs || []);

  // Pipeline
  renderPipeline(d.pipeline || []);

  // Channels
  renderChannels(d.channels || []);

  // Features
  renderFeatures(d.features || []);

  // Timestamp
  if (d.generatedAt) {
    const t = new Date(d.generatedAt);
    $('last-updated').textContent = t.toLocaleTimeString();
  }
}

// ── Models ──────────────────────────────────────────────────────────
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
  // Primary cards (full width)
  for (const m of primary) {
    html += modelCardHTML(m, true);
  }
  // Secondary cards
  for (const m of secondary) {
    html += modelCardHTML(m, false);
  }
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

// ── Cron ────────────────────────────────────────────────────────────
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
    return `
      <div class="cron-item">
        <div class="cron-icon">${icon}</div>
        <div class="cron-body">
          <div class="cron-name">${esc(j.name)}</div>
          <div class="cron-schedule">${esc(j.schedule)}</div>
          ${lastRunLine}
        </div>
        <div class="cron-status ${esc(j.status)}">${esc(j.status)}</div>
      </div>`;
  }).join('');
}

// ── Pipeline ────────────────────────────────────────────────────────
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

// ── Channels ────────────────────────────────────────────────────────
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

// ── Features ────────────────────────────────────────────────────────
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

// ── Helpers ─────────────────────────────────────────────────────────
function esc(s) {
  if (s == null) return '';
  const el = document.createElement('span');
  el.textContent = String(s);
  return el.innerHTML;
}

// ── Boot ────────────────────────────────────────────────────────────
refresh();
