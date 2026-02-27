# Directive: Research Trending Topics

## Goal

Identify the top trending topics within the configured niche by scanning
multiple sources. Output a structured list of trends with metadata.

## Inputs

- `CONTENT_NICHE` from `.env` — the topic/industry to research
- Optional: date range (defaults to last 24 hours)

## Process

1. Query Google Trends RSS feed for the niche
2. Scrape top posts from Reddit subreddits related to the niche
3. Pull trending hashtags and topics from Twitter/X (via Scrape Creators if available)
4. Aggregate and deduplicate topics
5. Score each topic by recency, volume, and relevance to niche

## Execution Script

`execution/research_trends.py`

## Outputs

- `.tmp/trends.json` — structured list of trending topics:
  ```json
  [
    {
      "topic": "string",
      "score": 0.0-1.0,
      "sources": ["google_trends", "reddit", "twitter"],
      "keywords": ["keyword1", "keyword2"],
      "summary": "Brief description of why this is trending",
      "discovered_at": "ISO timestamp"
    }
  ]
  ```

## Edge Cases

- If Google Trends is rate-limited, fall back to RSS feeds only
- If no trends found for exact niche, broaden search to adjacent topics
- Always return at least 5 trends, even if some are lower confidence
- Cache results for 1 hour to avoid redundant API calls

## Learnings

- Google Trends RSS is reliable and free, no API key needed
- Reddit JSON endpoints (`/.json` suffix) work without authentication
- Rate limit: respect 1 request per 2 seconds for Reddit
