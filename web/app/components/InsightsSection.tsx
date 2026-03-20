"use client";

import type { Analysis } from "@/lib/types";

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
};

interface Props {
  analysis: Analysis | null;
}

export default function InsightsSection({ analysis }: Props) {
  if (!analysis) {
    return (
      <section className="section">
        <h1>Creator Insights</h1>
        <div className="empty-state">
          <h3>No Analysis Yet</h3>
          <p>Click &quot;Generate Content&quot; to analyze creator content.</p>
        </div>
      </section>
    );
  }

  const patterns = analysis.content_patterns || {};
  const topContent = analysis.top_performing_content || [];

  return (
    <section className="section">
      <h1>Creator Insights</h1>

      <div className="patterns-panel">
        <h2>Content Patterns</h2>
        <div className="pattern-grid">
          <div className="pattern-item">
            <h4>Avg Post Length</h4>
            <div className="pattern-value">{patterns.avg_post_length || "—"} chars</div>
          </div>
          <div className="pattern-item">
            <h4>Posts Analyzed</h4>
            <div className="pattern-value">{patterns.total_posts_analyzed || "—"}</div>
          </div>
          <div className="pattern-item">
            <h4>Best Media Type</h4>
            <div className="pattern-value">{patterns.best_media_types?.[0] || "—"}</div>
          </div>
          <div className="pattern-item">
            <h4>Top Hashtags</h4>
            <div className="pattern-value">
              {patterns.top_hashtags?.slice(0, 5).map((h) => `#${h}`).join(", ") || "—"}
            </div>
          </div>
        </div>
      </div>

      <h2>Top Performing Content</h2>
      {topContent.length === 0 ? (
        <div className="empty-state">
          <h3>No Creator Data</h3>
          <p>Configure target creators to see insights.</p>
        </div>
      ) : (
        <div className="insights-grid">
          {topContent.map((p, i) => (
            <div className="insight-card" key={i}>
              <div className="insight-header">
                <span className="insight-creator">@{p.creator}</span>
                <span className={`platform-badge ${p.platform}`}>
                  {PLATFORM_LABELS[p.platform] || p.platform}
                </span>
              </div>
              <div className="insight-text">{(p.post_text || "").slice(0, 400)}</div>
              <div className="insight-why">{p.why_it_works}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
