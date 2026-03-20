"use client";

import type { Trend, Analysis, GeneratedPost } from "@/lib/types";

interface Props {
  posts: GeneratedPost[];
  trends: Trend[];
  analysis: Analysis | null;
  niche: string;
}

export default function OverviewSection({ posts, trends, analysis, niche }: Props) {
  const creators = new Set(
    (analysis?.top_performing_content || []).map((p) => p.creator)
  );
  const recommendations = analysis?.recommendations || [];

  return (
    <section className="section">
      <h1>Dashboard Overview</h1>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-number">{posts.length}</span>
          <span className="stat-label">Posts Generated</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{trends.length}</span>
          <span className="stat-label">Trends Tracked</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{creators.size || "—"}</span>
          <span className="stat-label">Creators Monitored</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">4</span>
          <span className="stat-label">Platforms</span>
        </div>
      </div>

      <div className="recommendations-panel">
        <h2>Recommendations</h2>
        <ul>
          {recommendations.length === 0 ? (
            <li>Click &quot;Generate Content&quot; to run the pipeline and get recommendations.</li>
          ) : (
            recommendations.map((r, i) => <li key={i}>{r}</li>)
          )}
        </ul>
      </div>
    </section>
  );
}
