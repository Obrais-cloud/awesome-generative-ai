"use client";

import { useState, useCallback } from "react";
import type { Trend, ContentData, Analysis, GeneratedPost } from "@/lib/types";
import Sidebar from "./Sidebar";
import OverviewSection from "./OverviewSection";
import TrendsSection from "./TrendsSection";
import ContentSection from "./ContentSection";
import InsightsSection from "./InsightsSection";
import CalendarSection from "./CalendarSection";
import Toast from "./Toast";

type Section = "overview" | "trends" | "content" | "insights" | "calendar";

export default function Dashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [niche, setNiche] = useState("marketing");
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState("");

  const [trends, setTrends] = useState<Trend[]>([]);
  const [contentData, setContentData] = useState<ContentData | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  }, []);

  const runPipeline = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niche }),
      });

      if (!resp.ok) throw new Error("Pipeline failed");

      const data = await resp.json();
      setTrends(data.trends || []);
      setAnalysis(data.analysis || null);
      setContentData({
        generated_at: data.generated_at,
        niche: data.niche,
        generation_mode: data.generation_mode,
        topics_used: data.topics_used,
        total_posts: data.total_posts,
        posts: data.posts,
      });
      setLastUpdated(new Date().toLocaleString());
      showToast("Pipeline complete — content generated!");
    } catch (err) {
      console.error(err);
      showToast("Error running pipeline. Check console.");
    } finally {
      setLoading(false);
    }
  }, [niche, showToast]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
  }, [showToast]);

  const posts = contentData?.posts || [];

  return (
    <div className="app-layout">
      <Sidebar
        section={section}
        setSection={setSection}
        niche={niche}
        setNiche={setNiche}
        loading={loading}
        onRun={runPipeline}
        lastUpdated={lastUpdated}
      />
      <main className="main-content">
        {section === "overview" && (
          <OverviewSection
            posts={posts}
            trends={trends}
            analysis={analysis}
            niche={contentData?.niche || niche}
          />
        )}
        {section === "trends" && <TrendsSection trends={trends} />}
        {section === "content" && (
          <ContentSection posts={posts} onCopy={copyToClipboard} />
        )}
        {section === "insights" && <InsightsSection analysis={analysis} />}
        {section === "calendar" && <CalendarSection posts={posts} />}

        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Running pipeline — researching trends, analyzing content, generating posts...</p>
          </div>
        )}
      </main>
      <Toast message={toastMsg} />
    </div>
  );
}
