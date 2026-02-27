/* ==========================================================
   Content Machine Dashboard — Client JS
   ========================================================== */

// State
let contentData = null;
let trendsData = null;
let analysisData = null;
let currentFilter = "all";

// ---- Data Loading ----
async function loadData() {
  try {
    const [contentResp, trendsResp, analysisResp] = await Promise.allSettled([
      fetch("/api/content"),
      fetch("/api/trends"),
      fetch("/api/analysis"),
    ]);

    if (contentResp.status === "fulfilled" && contentResp.value.ok) {
      contentData = await contentResp.value.json();
    }
    if (trendsResp.status === "fulfilled" && trendsResp.value.ok) {
      trendsData = await trendsResp.value.json();
    }
    if (analysisResp.status === "fulfilled" && analysisResp.value.ok) {
      analysisData = await analysisResp.value.json();
    }

    render();
  } catch (err) {
    console.error("Failed to load data:", err);
  }
}

// ---- Render Functions ----
function render() {
  renderOverview();
  renderTrends();
  renderContent();
  renderInsights();
  renderCalendar();
  updateLastUpdated();
}

function renderOverview() {
  const posts = contentData?.posts || [];
  const trends = trendsData || [];
  const creators = new Set(
    (analysisData?.top_performing_content || []).map((p) => p.creator)
  );

  document.getElementById("statPosts").textContent = posts.length;
  document.getElementById("statTrends").textContent = trends.length;
  document.getElementById("statCreators").textContent = creators.size || "—";
  document.getElementById("nicheBadge").textContent =
    contentData?.niche || "—";

  // Recommendations
  const list = document.getElementById("recommendationsList");
  const recs = analysisData?.recommendations || [];
  if (recs.length === 0) {
    list.innerHTML =
      '<li>Run the pipeline to generate recommendations.</li>';
  } else {
    list.innerHTML = recs.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  }
}

function renderTrends() {
  const grid = document.getElementById("trendsGrid");
  const trends = trendsData || [];

  if (trends.length === 0) {
    grid.innerHTML = emptyState(
      "No Trends Yet",
      "Run research_trends.py to discover trending topics."
    );
    return;
  }

  grid.innerHTML = trends
    .map((t) => {
      const scoreClass =
        t.score > 0.7 ? "high" : t.score > 0.4 ? "medium" : "low";
      const sources = (t.sources || [])
        .map((s) => `<span class="tag tag-source">${escapeHtml(s)}</span>`)
        .join(" ");
      return `
      <div class="trend-card">
        <div class="trend-title">${escapeHtml(t.topic)}</div>
        <div class="trend-summary">${escapeHtml(
          (t.summary || "").slice(0, 200)
        )}</div>
        <div class="trend-meta">
          <span class="tag tag-score ${scoreClass}">Score: ${(
        t.score * 100
      ).toFixed(0)}%</span>
          ${sources}
        </div>
      </div>`;
    })
    .join("");
}

function renderContent() {
  const grid = document.getElementById("contentGrid");
  let posts = contentData?.posts || [];

  if (currentFilter !== "all") {
    posts = posts.filter((p) => p.platform === currentFilter);
  }

  if (posts.length === 0) {
    grid.innerHTML = emptyState(
      "No Content Generated",
      "Run generate_content.py to create posts."
    );
    return;
  }

  grid.innerHTML = posts
    .map(
      (p) => `
    <div class="post-card" data-platform="${p.platform}">
      <div class="post-header">
        <span class="platform-badge ${p.platform}">${platformLabel(
        p.platform
      )}</span>
        <span class="engagement-badge ${p.estimated_engagement}">${
        p.estimated_engagement
      } est.</span>
      </div>
      <div class="post-topic">${escapeHtml(p.topic)}</div>
      <div class="post-body">${escapeHtml(p.content)}</div>
      <div class="post-footer">
        <span class="post-date">${formatDate(p.generated_at)}</span>
        <button class="btn btn-sm btn-copy" onclick="copyPost(this, ${escapeAttr(
          JSON.stringify(p.content)
        )})">Copy</button>
      </div>
    </div>`
    )
    .join("");
}

function renderInsights() {
  const patternsPanel = document.getElementById("patternsPanel");
  const insightsGrid = document.getElementById("insightsGrid");

  if (!analysisData) {
    patternsPanel.innerHTML = emptyState(
      "No Analysis Yet",
      "Run analyze_content.py first."
    );
    insightsGrid.innerHTML = "";
    return;
  }

  const patterns = analysisData.content_patterns || {};
  patternsPanel.innerHTML = `
    <h2>Content Patterns</h2>
    <div class="pattern-grid">
      <div class="pattern-item">
        <h4>Avg Post Length</h4>
        <div class="pattern-value">${
          patterns.avg_post_length || "—"
        } chars</div>
      </div>
      <div class="pattern-item">
        <h4>Posts Analyzed</h4>
        <div class="pattern-value">${
          patterns.total_posts_analyzed || "—"
        }</div>
      </div>
      <div class="pattern-item">
        <h4>Best Media Type</h4>
        <div class="pattern-value">${
          (patterns.best_media_types || [])[0] || "—"
        }</div>
      </div>
      <div class="pattern-item">
        <h4>Top Hashtags</h4>
        <div class="pattern-value">${(patterns.top_hashtags || [])
          .slice(0, 5)
          .map((h) => "#" + h)
          .join(", ") || "—"}</div>
      </div>
    </div>`;

  const topContent = analysisData.top_performing_content || [];
  if (topContent.length === 0) {
    insightsGrid.innerHTML = emptyState(
      "No Creator Data",
      "Configure target creators in .env."
    );
    return;
  }

  insightsGrid.innerHTML = topContent
    .map(
      (p) => `
    <div class="insight-card">
      <div class="insight-header">
        <span class="insight-creator">@${escapeHtml(p.creator)}</span>
        <span class="platform-badge ${p.platform}">${platformLabel(
        p.platform
      )}</span>
      </div>
      <div class="insight-text">${escapeHtml(
        (p.post_text || "").slice(0, 400)
      )}</div>
      <div class="insight-why">${escapeHtml(p.why_it_works)}</div>
    </div>`
    )
    .join("");
}

function renderCalendar() {
  const view = document.getElementById("calendarView");
  const posts = contentData?.posts || [];

  if (posts.length === 0) {
    view.innerHTML = emptyState(
      "No Content Scheduled",
      "Generate content to populate the calendar."
    );
    return;
  }

  // Group posts by date
  const groups = {};
  posts.forEach((p) => {
    const date = (p.generated_at || "").split("T")[0] || "Unknown";
    if (!groups[date]) groups[date] = [];
    groups[date].push(p);
  });

  view.innerHTML = Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(
      ([date, dayPosts]) => `
    <div class="calendar-day">
      <h3>${date}</h3>
      ${dayPosts
        .map(
          (p) => `
        <div class="calendar-post">
          <span class="platform-badge ${p.platform}" style="margin-right:8px">${platformLabel(
            p.platform
          )}</span>
          ${escapeHtml((p.topic || "").slice(0, 60))}
        </div>`
        )
        .join("")}
    </div>`
    )
    .join("");
}

// ---- Helpers ----
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function platformLabel(p) {
  const labels = {
    twitter: "Twitter/X",
    linkedin: "LinkedIn",
    instagram: "Instagram",
    tiktok: "TikTok",
  };
  return labels[p] || p;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function emptyState(title, desc) {
  return `<div class="empty-state"><h3>${title}</h3><p>${desc}</p></div>`;
}

function copyPost(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("Copied to clipboard!");
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy"), 2000);
  });
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

function updateLastUpdated() {
  const el = document.getElementById("lastUpdated");
  const ts = contentData?.generated_at;
  el.textContent = ts ? `Updated: ${formatDate(ts)}` : "No data yet";
}

// ---- Navigation ----
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const section = link.dataset.section;

    document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));
    link.classList.add("active");

    document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
    document.getElementById(section).classList.add("active");
  });
});

// ---- Platform Filters ----
document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.platform;
    renderContent();
  });
});

// ---- Refresh ----
document.getElementById("refreshBtn").addEventListener("click", () => {
  loadData();
  showToast("Data refreshed!");
});

// ---- Init ----
loadData();

// Auto-refresh every 60 seconds
setInterval(loadData, 60000);
