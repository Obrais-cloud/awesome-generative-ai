"use client";

import { useState } from "react";
import type { GeneratedPost } from "@/lib/types";

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
};

const FILTERS = ["all", "twitter", "linkedin", "instagram", "tiktok"];

interface Props {
  posts: GeneratedPost[];
  onCopy: (text: string) => void;
}

export default function ContentSection({ posts, onCopy }: Props) {
  const [filter, setFilter] = useState("all");
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = filter === "all" ? posts : posts.filter((p) => p.platform === filter);

  const handleCopy = (id: string, content: string) => {
    onCopy(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (posts.length === 0) {
    return (
      <section className="section">
        <h1>Generated Content</h1>
        <div className="empty-state">
          <h3>No Content Generated</h3>
          <p>Click &quot;Generate Content&quot; to create platform-optimized posts.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <h1>Generated Content</h1>
      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : PLATFORM_LABELS[f] || f}
          </button>
        ))}
      </div>
      <div className="content-grid">
        {filtered.map((p) => (
          <div className="post-card" key={p.id}>
            <div className="post-header">
              <span className={`platform-badge ${p.platform}`}>
                {PLATFORM_LABELS[p.platform] || p.platform}
              </span>
              <span className={`engagement-badge ${p.estimated_engagement}`}>
                {p.estimated_engagement} est.
              </span>
            </div>
            <div className="post-topic">{p.topic}</div>
            <div className="post-body">{p.content}</div>
            <div className="post-footer">
              <span className="post-date">
                {p.generated_at ? new Date(p.generated_at).toLocaleString() : "—"}
              </span>
              <button
                className="btn btn-sm btn-copy"
                onClick={() => handleCopy(p.id, p.content)}
              >
                {copied === p.id ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
