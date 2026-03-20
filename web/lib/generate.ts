import Anthropic from "@anthropic-ai/sdk";
import type { Trend, Analysis, GeneratedPost } from "./types";

const PLATFORMS = ["twitter", "linkedin", "instagram", "tiktok"] as const;

const PLATFORM_CONFIG: Record<string, { maxLength: number; hashtagCount: number; tone: string; format: string }> = {
  twitter:   { maxLength: 280,  hashtagCount: 3,  tone: "punchy, conversational, hook-driven", format: "short-form" },
  linkedin:  { maxLength: 1500, hashtagCount: 5,  tone: "professional, insightful, storytelling", format: "long-form with line breaks" },
  instagram: { maxLength: 2200, hashtagCount: 25, tone: "engaging, visual-first, relatable", format: "caption with hashtag block" },
  tiktok:    { maxLength: 500,  hashtagCount: 5,  tone: "energetic, casual, hook in first 3 seconds", format: "video script with timestamps" },
};

// Template-based fallback hooks
function getHooks(niche: string) {
  return {
    question: [
      `What if everything you knew about ${niche} was wrong?`,
      `Why do 90% of ${niche} strategies fail?`,
      `Is your ${niche} approach actually holding you back?`,
    ],
    controversial: [
      `Unpopular opinion: most ${niche} advice is outdated.`,
      `Hot take: ${niche} is going to look completely different in 6 months.`,
      `Nobody wants to hear this about ${niche}, but…`,
    ],
    value: [
      `The ${niche} hack that changed everything for me:`,
      `Here's what I learned from studying 100+ ${niche} strategies:`,
      `3 ${niche} lessons I wish I learned sooner:`,
    ],
  };
}

const CTAS = [
  "What's your take? Drop a comment below.",
  "Follow for more insights like this.",
  "Save this for later — you'll need it.",
  "Share this with someone who needs to hear it.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function templateGenerate(topic: Trend, platform: string, niche: string, analysis?: Analysis): string {
  const config = PLATFORM_CONFIG[platform];
  const hooks = getHooks(niche);
  const hookStyle = pickRandom(Object.keys(hooks) as (keyof ReturnType<typeof getHooks>)[]);
  const hook = pickRandom(hooks[hookStyle]);
  const cta = pickRandom(CTAS);

  const topHashtags = analysis?.content_patterns?.top_hashtags || topic.keywords;
  const hashtags = topHashtags.slice(0, config.hashtagCount).map((t) => `#${t}`).join(" ");
  const value = `The key insight about ${topic.topic}: ${topic.summary}`.slice(0, config.maxLength / 2);

  if (platform === "tiktok") {
    return `HOOK (0-3s): ${hook}\nSETUP (3-10s): Everyone's talking about ${topic.topic}. Here's why.\nVALUE (10-45s): ${value}\nCTA (45-60s): ${cta}`;
  }

  if (platform === "linkedin") {
    return `${hook}\n\n${value}\n\nKey takeaways:\n• This trend is reshaping ${niche}\n• Early movers have a clear advantage\n• The data speaks for itself\n\n${cta}\n\n${hashtags}`;
  }

  if (platform === "instagram") {
    return `${hook}\n\n${value}\n\n${cta}\n\n.\n.\n.\n${hashtags}`;
  }

  // twitter
  const post = `${hook}\n\n${value.slice(0, 180)}\n\n${hashtags}`;
  return post.slice(0, 280);
}

async function claudeGenerate(
  topic: Trend,
  platform: string,
  niche: string,
  analysis: Analysis | undefined,
  apiKey: string
): Promise<string | null> {
  const config = PLATFORM_CONFIG[platform];
  const topHooks = analysis?.content_patterns?.top_hooks?.slice(0, 5) || [];
  const topHashtags = analysis?.content_patterns?.top_hashtags?.slice(0, 10) || [];

  const client = new Anthropic({ apiKey });

  try {
    const resp = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are an expert ${niche} content creator. Generate a single social media post.

Rules:
- Platform: ${platform}
- Max length: ${config.maxLength} characters
- Tone: ${config.tone}
- Format: ${config.format}
- Include exactly ${config.hashtagCount} relevant hashtags
- The post must be original and provide real value
${topHooks.length ? `- Study these hook examples from top performers:\n${topHooks.map((h) => `  - ${h}`).join("\n")}` : ""}

Return ONLY the post text, nothing else.`,
      messages: [{
        role: "user",
        content: `Create a ${platform} post about this trending topic in ${niche}:

Topic: ${topic.topic}
Context: ${topic.summary}
Keywords: ${topic.keywords.slice(0, 10).join(", ")}
${topHashtags.length ? `Trending hashtags: ${topHashtags.map((t) => "#" + t).join(", ")}` : ""}`,
      }],
    });

    const block = resp.content[0];
    if (block.type === "text") return block.text.trim();
    return null;
  } catch (e) {
    console.error(`[claude] Error for ${platform}:`, e);
    return null;
  }
}

export async function generateContent(
  niche: string,
  trends: Trend[],
  analysis?: Analysis,
  anthropicKey?: string
): Promise<GeneratedPost[]> {
  const useAI = Boolean(anthropicKey);
  const selected = trends.slice(0, 5);
  const posts: GeneratedPost[] = [];

  for (const topic of selected) {
    for (const platform of PLATFORMS) {
      let content: string | null = null;

      if (useAI && anthropicKey) {
        content = await claudeGenerate(topic, platform, niche, analysis, anthropicKey);
      }

      if (!content) {
        content = templateGenerate(topic, platform, niche, analysis);
      }

      const hashtags = (content.match(/#(\w+)/g) || []).map((h) => h.slice(1));
      const estEngagement = topic.score > 0.7 ? "high" : topic.score > 0.4 ? "medium" : "low";

      posts.push({
        id: crypto.randomUUID(),
        topic: topic.topic,
        trend_score: topic.score,
        platform,
        content,
        hashtags,
        content_type: platform === "tiktok" ? "script" : platform === "instagram" ? "caption" : "text",
        hook: content.split("\n")[0].slice(0, 200),
        estimated_engagement: estEngagement as "low" | "medium" | "high",
        based_on_trend: topic.summary,
        generated_at: new Date().toISOString(),
      });
    }
  }

  return posts;
}
