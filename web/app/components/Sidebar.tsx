"use client";

type Section = "overview" | "trends" | "content" | "insights" | "calendar";

interface Props {
  section: Section;
  setSection: (s: Section) => void;
  niche: string;
  setNiche: (n: string) => void;
  loading: boolean;
  onRun: () => void;
  lastUpdated: string;
}

const NAV_ITEMS: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "trends", label: "Trending Topics" },
  { id: "content", label: "Generated Content" },
  { id: "insights", label: "Creator Insights" },
  { id: "calendar", label: "Content Calendar" },
];

export default function Sidebar({ section, setSection, niche, setNiche, loading, onRun, lastUpdated }: Props) {
  return (
    <nav className="sidebar">
      <div className="logo">
        <h2>Content Machine</h2>
        <span className="niche-badge">{niche}</span>
      </div>
      <ul className="nav-links">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-link ${section === item.id ? "active" : ""}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <div className="niche-input-row">
          <input
            type="text"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="Enter niche..."
          />
        </div>
        <button className="btn btn-primary" onClick={onRun} disabled={loading}>
          {loading ? "Running..." : "Generate Content"}
        </button>
        <p className="last-updated">{lastUpdated || "No data yet"}</p>
      </div>
    </nav>
  );
}
