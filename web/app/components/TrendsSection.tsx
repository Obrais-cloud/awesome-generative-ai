"use client";

import type { Trend } from "@/lib/types";

interface Props {
  trends: Trend[];
}

export default function TrendsSection({ trends }: Props) {
  if (trends.length === 0) {
    return (
      <section className="section">
        <h1>Trending Topics</h1>
        <div className="empty-state">
          <h3>No Trends Yet</h3>
          <p>Click &quot;Generate Content&quot; to discover trending topics in your niche.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <h1>Trending Topics</h1>
      <div className="trends-grid">
        {trends.map((t, i) => {
          const scoreClass = t.score > 0.7 ? "high" : t.score > 0.4 ? "medium" : "low";
          return (
            <div className="trend-card" key={i}>
              <div className="trend-title">{t.topic}</div>
              <div className="trend-summary">{(t.summary || "").slice(0, 200)}</div>
              <div className="trend-meta">
                <span className={`tag tag-score ${scoreClass}`}>
                  Score: {Math.round(t.score * 100)}%
                </span>
                {t.sources.map((s) => (
                  <span className="tag tag-source" key={s}>{s}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
