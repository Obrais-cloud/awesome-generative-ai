export interface Trend {
  topic: string;
  score: number;
  sources: string[];
  keywords: string[];
  summary: string;
  discovered_at: string;
}

export interface CreatorPost {
  creator: string;
  platform: string;
  post_text: string;
  post_date: string;
  engagement: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
  media_type: string;
  url: string;
  scraped_at: string;
}

export interface GeneratedPost {
  id: string;
  topic: string;
  trend_score: number;
  platform: "twitter" | "linkedin" | "instagram" | "tiktok";
  content: string;
  hashtags: string[];
  content_type: string;
  hook: string;
  estimated_engagement: "low" | "medium" | "high";
  based_on_trend: string;
  generated_at: string;
}

export interface ContentData {
  generated_at: string;
  niche: string;
  generation_mode: string;
  topics_used: number;
  total_posts: number;
  posts: GeneratedPost[];
}

export interface Analysis {
  trending_gaps: {
    topic: string;
    trend_score: number;
    creator_coverage: number;
    opportunity_score: number;
  }[];
  top_performing_content: {
    creator: string;
    platform: string;
    post_text: string;
    engagement_rate: number;
    engagement: Record<string, number>;
    why_it_works: string;
    hook: string;
  }[];
  content_patterns: {
    avg_post_length: number;
    top_hooks: string[];
    top_hashtags: string[];
    best_media_types: string[];
    best_posting_times: string[];
    hook_patterns: Record<string, number>;
    total_posts_analyzed: number;
  };
  recommendations: string[];
  analyzed_at: string;
  niche: string;
}
