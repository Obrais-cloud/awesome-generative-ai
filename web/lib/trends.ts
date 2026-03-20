import type { Trend } from "./types";

const NICHE_SUBREDDITS: Record<string, string[]> = {
  marketing: ["marketing", "digitalmarketing", "socialmedia", "SEO", "content_marketing"],
  ai: ["artificial", "MachineLearning", "ChatGPT", "LocalLLaMA", "singularity"],
  fitness: ["fitness", "bodybuilding", "running", "nutrition", "weightroom"],
  tech: ["technology", "programming", "webdev", "startups", "SaaS"],
  finance: ["finance", "investing", "stocks", "CryptoCurrency", "personalfinance"],
  design: ["design", "graphic_design", "UI_Design", "web_design", "UXDesign"],
};

export async function fetchGoogleTrends(niche: string): Promise<Trend[]> {
  try {
    // Google Trends RSS doesn't support CORS, so we fetch server-side
    const resp = await fetch("https://trends.google.com/trending/rss?geo=US", {
      next: { revalidate: 3600 },
    });
    if (!resp.ok) return [];

    const text = await resp.text();
    const trends: Trend[] = [];

    // Simple XML parsing for RSS items
    const items = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
    const nicheWords = new Set(niche.toLowerCase().split(/\s+/));

    for (const item of items.slice(0, 20)) {
      const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                          item.match(/<title>(.*?)<\/title>/);
      const title = titleMatch?.[1]?.trim() || "";
      if (!title) continue;

      const descMatch = item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                         item.match(/<description>(.*?)<\/description>/);
      const summary = descMatch?.[1]?.trim() || `Trending on Google: ${title}`;

      const titleWords = new Set(title.toLowerCase().split(/\s+/));
      const allWords = new Set([...titleWords, ...summary.toLowerCase().split(/\s+/)]);
      let overlap = 0;
      for (const w of nicheWords) {
        if (allWords.has(w)) overlap++;
      }
      const relevance = Math.min(1.0, 0.3 + overlap * 0.3);

      trends.push({
        topic: title,
        score: Math.round(relevance * 100) / 100,
        sources: ["google_trends"],
        keywords: Array.from(titleWords).slice(0, 10),
        summary: summary.slice(0, 300),
        discovered_at: new Date().toISOString(),
      });
    }
    return trends;
  } catch (e) {
    console.error("[google] Error:", e);
    return [];
  }
}

export async function fetchRedditTrends(niche: string): Promise<Trend[]> {
  const subreddits = NICHE_SUBREDDITS[niche.toLowerCase()] || [niche];
  const trends: Trend[] = [];

  for (const sub of subreddits) {
    try {
      const resp = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
        headers: { "User-Agent": "ContentMachine/1.0" },
        next: { revalidate: 3600 },
      });
      if (!resp.ok) continue;

      const data = await resp.json();
      const children = data?.data?.children || [];

      for (const child of children) {
        const post = child?.data;
        if (!post?.title || post.stickied) continue;

        const ups = post.ups || 0;
        const comments = post.num_comments || 0;
        const engagement = ups + comments * 2;
        const score = Math.round(Math.min(1.0, engagement / 5000) * 100) / 100;

        trends.push({
          topic: post.title,
          score,
          sources: ["reddit"],
          keywords: Array.from(new Set(post.title.toLowerCase().split(/\s+/))) as string[],
          summary: `Hot on r/${sub} — ${ups} upvotes, ${comments} comments`,
          discovered_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error(`[reddit] Error fetching r/${sub}:`, e);
    }
    // Small delay between subreddits
    await new Promise((r) => setTimeout(r, 500));
  }

  trends.sort((a, b) => b.score - a.score);
  return trends.slice(0, 15);
}

export function deduplicateTrends(trends: Trend[]): Trend[] {
  const seen = new Map<string, Trend>();

  for (const t of trends) {
    const key = t.topic.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim().slice(0, 50);
    const existing = seen.get(key);
    if (existing) {
      existing.score = Math.round(Math.max(existing.score, t.score) * 100) / 100;
      for (const src of t.sources) {
        if (!existing.sources.includes(src)) existing.sources.push(src);
      }
    } else {
      seen.set(key, { ...t });
    }
  }

  return Array.from(seen.values());
}

export async function researchTrends(niche: string): Promise<Trend[]> {
  const [google, reddit] = await Promise.all([
    fetchGoogleTrends(niche),
    fetchRedditTrends(niche),
  ]);

  let trends = deduplicateTrends([...google, ...reddit]);
  trends.sort((a, b) => b.score - a.score);

  // Ensure at least 5 trends
  while (trends.length < 5) {
    trends.push({
      topic: `Latest developments in ${niche}`,
      score: 0.1,
      sources: ["fallback"],
      keywords: niche.toLowerCase().split(/\s+/),
      summary: `General ${niche} industry update`,
      discovered_at: new Date().toISOString(),
    });
  }

  return trends;
}
