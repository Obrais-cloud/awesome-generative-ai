import type { CreatorPost } from "./types";

export function getSampleCreatorPosts(niche: string): CreatorPost[] {
  const now = new Date().toISOString();
  return [
    {
      creator: "sample_creator_1",
      platform: "twitter",
      post_text: `The biggest shift in ${niche} this year isn't what you think. It's not AI. It's not automation. It's the return to authentic, human-first content. Here's why that matters for your strategy:`,
      post_date: now,
      engagement: { likes: 2847, comments: 234, shares: 891, views: 148000 },
      media_type: "text",
      url: "",
      scraped_at: now,
    },
    {
      creator: "sample_creator_2",
      platform: "linkedin",
      post_text: `I spent 6 months testing every ${niche} tool on the market.\n\nHere are my top 5 findings:\n\n1. Most tools solve problems you don't have\n2. The best ROI comes from fundamentals, not fancy tech\n3. Consistency beats complexity every single time\n4. Your audience doesn't care about your tech stack\n5. The winner is always the one who ships fastest\n\nStop optimizing. Start publishing.`,
      post_date: now,
      engagement: { likes: 5621, comments: 487, shares: 1203, views: 320000 },
      media_type: "text",
      url: "",
      scraped_at: now,
    },
    {
      creator: "sample_creator_1",
      platform: "instagram",
      post_text: `POV: You finally stopped overthinking your ${niche} strategy and just started creating.\n\nThe results? 3x engagement in 30 days.\n\nHere's exactly what I changed (save this):\n\n1. Posted daily instead of weekly\n2. Led with stories, not stats\n3. Asked questions in every caption\n4. Replied to every comment within 1 hour\n5. Stopped chasing trends, started setting them`,
      post_date: now,
      engagement: { likes: 12400, comments: 876, shares: 2100, views: 89000 },
      media_type: "carousel",
      url: "",
      scraped_at: now,
    },
    {
      creator: "sample_creator_3",
      platform: "tiktok",
      post_text: `Wait for it… the one ${niche} hack that nobody talks about. Most people spend hours on research. I spend 10 minutes. Here's my exact process.`,
      post_date: now,
      engagement: { likes: 45000, comments: 3200, shares: 8900, views: 1200000 },
      media_type: "video",
      url: "",
      scraped_at: now,
    },
    {
      creator: "sample_creator_2",
      platform: "twitter",
      post_text: `Unpopular opinion: ${niche} courses are a waste of money in 2026.\n\nEverything you need is free:\n- YouTube tutorials\n- Reddit communities\n- Open source tools\n- Free newsletters\n\nThe real skill? Filtering signal from noise.`,
      post_date: now,
      engagement: { likes: 8900, comments: 1100, shares: 3400, views: 560000 },
      media_type: "text",
      url: "",
      scraped_at: now,
    },
  ];
}
