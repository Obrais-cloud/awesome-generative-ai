# Directive: Generate Content

## Goal

Generate platform-optimized social media posts based on trending topics,
content analysis, and the user's niche. Each post should be ready to review
and publish.

## Inputs

- `.tmp/trends.json` — trending topics
- `.tmp/analysis.json` — content analysis and patterns
- `.tmp/creator_content.json` — reference content from creators
- `CONTENT_NICHE` from `.env`
- `ANTHROPIC_API_KEY` from `.env` — for Claude API content generation

## Process

1. Load all analysis data
2. Select the top 5 trending topics with highest opportunity scores
3. For each topic, generate content for each platform:
   - **Twitter/X:** Short-form (280 chars), hook-driven, 2-3 hashtags
   - **LinkedIn:** Professional tone, 1200-1500 chars, storytelling format
   - **Instagram:** Caption (2200 char max), 20-30 hashtags, visual hook
   - **TikTok:** Script format, hook in first 3 seconds, trending sounds ref
4. Apply patterns from top-performing content (hooks, length, hashtags)
5. Generate engagement hooks based on what's working
6. Save all generated content

## Execution Script

`execution/generate_content.py`

## Content Templates

### Twitter/X
```
[Hook — provocative statement or question]

[2-3 sentences of value]

[Call to action]

#hashtag1 #hashtag2
```

### LinkedIn
```
[Hook line — stops the scroll]

[Story or insight — 3-4 short paragraphs]

[Key takeaway]

[Call to action / question for engagement]

#hashtag1 #hashtag2 #hashtag3
```

### Instagram
```
[Hook — first line visible in feed]

[Value-driven body — tips, insights, story]

[Call to action]

.
.
.
[Hashtag block — 20-30 relevant hashtags]
```

### TikTok Script
```
HOOK (0-3s): [Attention grabber]
SETUP (3-10s): [Context]
VALUE (10-45s): [Main content]
CTA (45-60s): [Call to action]
```

## Outputs

- `dashboard/data/generated_content.json`:
  ```json
  {
    "generated_at": "ISO timestamp",
    "niche": "string",
    "posts": [
      {
        "id": "uuid",
        "topic": "string",
        "trend_score": 0.0-1.0,
        "platform": "twitter|linkedin|instagram|tiktok",
        "content": "string",
        "hashtags": ["string"],
        "content_type": "text|script|caption",
        "hook": "string",
        "estimated_engagement": "low|medium|high",
        "based_on_trend": "string",
        "generated_at": "ISO timestamp"
      }
    ]
  }
  ```

## Edge Cases

- If Anthropic API key is missing, use template-based generation (no AI)
- If analysis data is empty, generate content from trends alone
- Rate limit Claude API: max 5 requests per minute on free tier
- Always generate at least 1 post per platform per run
- Content must be original — never copy creator posts verbatim

## Learnings

- Posts with questions in the hook get 2-3x more engagement
- LinkedIn posts between 1200-1500 characters perform best
- Instagram: first line must be compelling — it's the only thing visible in feed
- TikTok: hook must land in first 3 seconds or viewers scroll
