import type { Trend, CreatorPost, Analysis } from "./types";

function computeEngagementRate(post: CreatorPost): number {
  const { likes, comments, shares, views } = post.engagement;
  const weighted = likes + comments * 3 + shares * 2;
  if (views > 0) return Math.round((weighted / views) * 10000) / 10000;
  return Math.round(Math.min(1.0, weighted / 10000) * 10000) / 10000;
}

function extractHook(text: string): string {
  if (!text) return "";
  const line = text.trim().split("\n")[0].trim();
  return line.replace(/^(POV:|THREAD:|BREAKING:|Hot take:)\s*/i, "").slice(0, 200);
}

function extractHashtags(text: string): string[] {
  return (text.match(/#(\w+)/g) || []).map((h) => h.slice(1));
}

export function analyzeContent(
  trends: Trend[],
  posts: CreatorPost[],
  niche: string
): Analysis {
  // Trending gaps
  const postTexts = posts.map((p) => p.post_text.toLowerCase()).join(" ");
  const trendingGaps = trends.map((t) => {
    const matches = t.keywords.filter((kw) => postTexts.includes(kw.toLowerCase())).length;
    const coverage = Math.round((matches / Math.max(t.keywords.length, 1)) * 100) / 100;
    return {
      topic: t.topic,
      trend_score: t.score,
      creator_coverage: coverage,
      opportunity_score: Math.round(t.score * (1 - coverage) * 100) / 100,
    };
  });
  trendingGaps.sort((a, b) => b.opportunity_score - a.opportunity_score);

  // Top performing content
  const scored = posts.map((p) => {
    const rate = computeEngagementRate(p);
    const hook = extractHook(p.post_text);
    const reasons: string[] = [];
    if (p.post_text.includes("?")) reasons.push("Uses questions to drive engagement");
    if (p.post_text.split("\n").length > 3) reasons.push("Well-structured with line breaks");
    if (/\d/.test(p.post_text)) reasons.push("Includes specific numbers/data");
    if (p.post_text.length > 500) reasons.push("Long-form content provides depth");
    if (hook.length < 80) reasons.push("Short, punchy hook grabs attention");
    if (!reasons.length) reasons.push("Strong topic relevance");

    return {
      creator: p.creator,
      platform: p.platform,
      post_text: p.post_text.slice(0, 500),
      engagement_rate: rate,
      engagement: p.engagement,
      why_it_works: reasons.slice(0, 3).join("; "),
      hook,
    };
  });
  scored.sort((a, b) => b.engagement_rate - a.engagement_rate);

  // Content patterns
  const lengths = posts.map((p) => p.post_text.length);
  const avgLength = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0;

  const allHashtags = posts.flatMap((p) => extractHashtags(p.post_text));
  const hashtagCounts = new Map<string, number>();
  for (const h of allHashtags) hashtagCounts.set(h, (hashtagCounts.get(h) || 0) + 1);
  const topHashtags = Array.from(hashtagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag]) => tag);

  const hooks = posts.map((p) => extractHook(p.post_text)).filter(Boolean).slice(0, 10);

  const hookPatterns: Record<string, number> = {};
  for (const h of hooks) {
    const lower = h.toLowerCase();
    if (h.includes("?")) hookPatterns["question"] = (hookPatterns["question"] || 0) + 1;
    else if (/unpopular|hot take/.test(lower)) hookPatterns["controversial_take"] = (hookPatterns["controversial_take"] || 0) + 1;
    else if (/here's|here are/.test(lower)) hookPatterns["direct_value"] = (hookPatterns["direct_value"] || 0) + 1;
    else if (/i spent|i tested/.test(lower)) hookPatterns["personal_story"] = (hookPatterns["personal_story"] || 0) + 1;
    else hookPatterns["statement"] = (hookPatterns["statement"] || 0) + 1;
  }

  const mediaCounts = new Map<string, number[]>();
  for (const p of posts) {
    const mt = p.media_type || "text";
    if (!mediaCounts.has(mt)) mediaCounts.set(mt, []);
    mediaCounts.get(mt)!.push(computeEngagementRate(p));
  }
  const bestMedia = Array.from(mediaCounts.entries())
    .sort((a, b) => {
      const avgA = a[1].reduce((x, y) => x + y, 0) / a[1].length;
      const avgB = b[1].reduce((x, y) => x + y, 0) / b[1].length;
      return avgB - avgA;
    })
    .map(([mt]) => mt)
    .slice(0, 5);

  // Recommendations
  const recommendations: string[] = [];
  if (trendingGaps.length) {
    const top = trendingGaps[0];
    recommendations.push(
      `Top opportunity: Create content about '${top.topic}' — trending at ${Math.round(top.trend_score * 100)}% but only ${Math.round(top.creator_coverage * 100)}% creator coverage.`
    );
  }
  if (Object.keys(hookPatterns).length) {
    const best = Object.entries(hookPatterns).sort((a, b) => b[1] - a[1])[0][0];
    recommendations.push(`Best performing hook style: ${best.replace(/_/g, " ")}.`);
  }
  if (bestMedia.length) recommendations.push(`Top media format: ${bestMedia[0]}.`);
  if (avgLength) recommendations.push(`Optimal post length: ~${avgLength} characters.`);
  if (topHashtags.length) recommendations.push(`Trending hashtags: ${topHashtags.slice(0, 5).map((t) => "#" + t).join(", ")}`);
  recommendations.push("Post consistently — daily content outperforms sporadic posting by 3-5x.");

  return {
    trending_gaps: trendingGaps.slice(0, 15),
    top_performing_content: scored.slice(0, 10),
    content_patterns: {
      avg_post_length: avgLength,
      top_hooks: hooks,
      top_hashtags: topHashtags,
      best_media_types: bestMedia,
      best_posting_times: ["9:00 AM", "12:00 PM", "6:00 PM"],
      hook_patterns: hookPatterns,
      total_posts_analyzed: posts.length,
    },
    recommendations,
    analyzed_at: new Date().toISOString(),
    niche,
  };
}
