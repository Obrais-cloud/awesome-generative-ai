"use client";

import type { GeneratedPost } from "@/lib/types";

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "Twitter/X",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
};

interface Props {
  posts: GeneratedPost[];
}

export default function CalendarSection({ posts }: Props) {
  if (posts.length === 0) {
    return (
      <section className="section">
        <h1>Content Calendar</h1>
        <div className="empty-state">
          <h3>No Content Scheduled</h3>
          <p>Generate content to populate the calendar.</p>
        </div>
      </section>
    );
  }

  // Group by date
  const groups: Record<string, GeneratedPost[]> = {};
  for (const p of posts) {
    const date = (p.generated_at || "").split("T")[0] || "Unknown";
    if (!groups[date]) groups[date] = [];
    groups[date].push(p);
  }

  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return (
    <section className="section">
      <h1>Content Calendar</h1>
      <div className="calendar-view">
        {sortedDates.map((date) => (
          <div className="calendar-day" key={date}>
            <h3>{date}</h3>
            {groups[date].map((p) => (
              <div className="calendar-post" key={p.id}>
                <span
                  className={`platform-badge ${p.platform}`}
                  style={{ marginRight: 8 }}
                >
                  {PLATFORM_LABELS[p.platform] || p.platform}
                </span>
                {(p.topic || "").slice(0, 60)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
