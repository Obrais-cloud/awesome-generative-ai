# Directive: Analyze Content

## Goal

Analyze scraped creator content and trending topics to identify patterns,
high-performing content formats, and content opportunities for the user's niche.

## Inputs

- `.tmp/trends.json` — from research_trends
- `.tmp/creator_content.json` — from scrape_creators
- `CONTENT_NICHE` from `.env`

## Process

1. Load trends and creator content
2. Cross-reference: which creators are already covering which trends?
3. Identify content gaps — trending topics not yet covered by target creators
4. Rank creator posts by engagement rate
5. Extract patterns from top-performing content:
   - Average post length
   - Common hooks (first line patterns)
   - Hashtag strategies
   - Media type distribution
   - Posting time patterns
6. Generate an analysis report with actionable insights

## Execution Script

`execution/analyze_content.py`

## Outputs

- `.tmp/analysis.json`:
  ```json
  {
    "trending_gaps": [
      {
        "topic": "string",
        "trend_score": 0.0-1.0,
        "creator_coverage": 0.0-1.0,
        "opportunity_score": 0.0-1.0
      }
    ],
    "top_performing_content": [
      {
        "creator": "string",
        "platform": "string",
        "post_text": "string",
        "engagement_rate": 0.0,
        "why_it_works": "string"
      }
    ],
    "content_patterns": {
      "avg_post_length": 0,
      "top_hooks": ["string"],
      "top_hashtags": ["string"],
      "best_media_types": ["string"],
      "best_posting_times": ["string"]
    },
    "recommendations": ["string"],
    "analyzed_at": "ISO timestamp"
  }
  ```

## Edge Cases

- If no creator content available, analyze trends only
- If no trends available, analyze creator content only
- Minimum 3 posts needed to identify patterns — log warning if fewer
- Handle division by zero in engagement rate calculations
