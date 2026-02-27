# Directive: Scrape Creator Content

## Goal

Pull the latest content from target creators across platforms using the
Scrape Creators API service. Extract post text, engagement metrics, and media
metadata for analysis.

## Inputs

- `SCRAPE_CREATORS_API_KEY` from `.env`
- `TARGET_CREATORS_INSTAGRAM`, `TARGET_CREATORS_TWITTER`,
  `TARGET_CREATORS_LINKEDIN`, `TARGET_CREATORS_TIKTOK` from `.env`
- Each is a comma-separated list of usernames/handles

## Process

1. Load target creators from environment
2. For each platform and creator:
   a. Call the Scrape Creators API to fetch recent posts
   b. Extract: post text, engagement (likes, comments, shares), post date, media type
   c. Store raw response in `.tmp/raw/`
3. Normalize data across platforms into a unified format
4. Save merged results

## Execution Script

`execution/scrape_creators.py`

## API Reference

Scrape Creators API:
- Base URL: `https://api.scrapecreators.com/v1`
- Auth: Bearer token via `SCRAPE_CREATORS_API_KEY`
- Endpoints:
  - `GET /instagram/profile/{username}` — profile + recent posts
  - `GET /twitter/profile/{username}` — profile + recent tweets
  - `GET /linkedin/profile/{username}` — profile + recent posts
  - `GET /tiktok/profile/{username}` — profile + recent videos

## Outputs

- `.tmp/raw/{platform}_{username}.json` — raw API responses
- `.tmp/creator_content.json` — normalized content:
  ```json
  [
    {
      "creator": "username",
      "platform": "instagram|twitter|linkedin|tiktok",
      "post_text": "string",
      "post_date": "ISO timestamp",
      "engagement": {
        "likes": 0,
        "comments": 0,
        "shares": 0,
        "views": 0
      },
      "media_type": "text|image|video|carousel",
      "url": "original post URL",
      "scraped_at": "ISO timestamp"
    }
  ]
  ```

## Edge Cases

- If API key is missing, log error and skip (don't crash)
- If a creator username is invalid or private, skip and log warning
- Rate limit: max 60 requests per minute — add 1-second delay between calls
- If API returns 429, back off exponentially (2s, 4s, 8s, 16s)
- Store raw responses so we can re-process without re-scraping

## Learnings

- Scrape Creators trial accounts have limited requests — batch wisely
- Instagram private accounts will return empty — skip gracefully
- Always store raw responses in `.tmp/raw/` for debugging
