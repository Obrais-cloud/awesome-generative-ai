#!/usr/bin/env python3
"""
Scrape Creators — Layer 3 Execution Script

Pulls latest content from target creators across platforms using the
Scrape Creators API. Normalizes data into a unified format.

Usage:
  python execution/scrape_creators.py
"""

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

API_KEY = os.getenv("SCRAPE_CREATORS_API_KEY", "")
BASE_URL = "https://api.scrapecreators.com/v1"
TMP_DIR = Path(".tmp")
RAW_DIR = TMP_DIR / "raw"
OUTPUT_FILE = TMP_DIR / "creator_content.json"

# Rate limiting
REQUEST_DELAY = 1.0  # seconds between API calls
MAX_RETRIES = 4
BACKOFF_BASE = 2  # exponential backoff: 2s, 4s, 8s, 16s

# Platform configs from .env
PLATFORMS = {
    "instagram": os.getenv("TARGET_CREATORS_INSTAGRAM", ""),
    "twitter": os.getenv("TARGET_CREATORS_TWITTER", ""),
    "linkedin": os.getenv("TARGET_CREATORS_LINKEDIN", ""),
    "tiktok": os.getenv("TARGET_CREATORS_TIKTOK", ""),
}

# API endpoint patterns
ENDPOINTS = {
    "instagram": "/instagram/profile/{username}",
    "twitter": "/twitter/profile/{username}",
    "linkedin": "/linkedin/profile/{username}",
    "tiktok": "/tiktok/profile/{username}",
}


def ensure_dirs():
    """Create necessary directories."""
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    RAW_DIR.mkdir(parents=True, exist_ok=True)


def parse_creators(env_value):
    """Parse comma-separated creator list from env variable."""
    if not env_value:
        return []
    return [c.strip() for c in env_value.split(",") if c.strip()]


def api_request(endpoint, retries=MAX_RETRIES):
    """
    Make an authenticated API request with exponential backoff retry.
    Returns parsed JSON or None on failure.
    """
    url = f"{BASE_URL}{endpoint}"
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "ContentMachine/1.0",
    }

    for attempt in range(retries):
        try:
            resp = requests.get(url, headers=headers, timeout=30)

            if resp.status_code == 200:
                return resp.json()

            if resp.status_code == 429:
                wait = BACKOFF_BASE ** (attempt + 1)
                print(f"  [rate-limit] 429 received, backing off {wait}s …")
                time.sleep(wait)
                continue

            if resp.status_code in (401, 403):
                print(f"  [auth] {resp.status_code} — check SCRAPE_CREATORS_API_KEY")
                return None

            if resp.status_code == 404:
                print(f"  [not-found] {endpoint} — creator may not exist or is private")
                return None

            print(f"  [error] {resp.status_code}: {resp.text[:200]}")
            if attempt < retries - 1:
                wait = BACKOFF_BASE ** (attempt + 1)
                time.sleep(wait)

        except requests.exceptions.RequestException as e:
            print(f"  [network] {e}")
            if attempt < retries - 1:
                wait = BACKOFF_BASE ** (attempt + 1)
                print(f"  Retrying in {wait}s …")
                time.sleep(wait)

    return None


def normalize_post(raw_post, creator, platform):
    """Convert a raw API post into our standard format."""
    # The exact field names depend on the Scrape Creators API response.
    # This provides sensible defaults and tries multiple field names.
    def get_field(*keys, default=""):
        for k in keys:
            if k in raw_post and raw_post[k]:
                return raw_post[k]
        return default

    post_text = get_field("text", "caption", "body", "content", "description")
    post_date = get_field("created_at", "timestamp", "date", "posted_at",
                          default=datetime.now(timezone.utc).isoformat())

    likes = get_field("likes", "like_count", "likesCount", default=0)
    comments = get_field("comments", "comment_count", "commentsCount", default=0)
    shares = get_field("shares", "share_count", "sharesCount", "retweets", "reposts", default=0)
    views = get_field("views", "view_count", "viewsCount", "impressions", default=0)

    media_type = get_field("media_type", "type", default="text")
    url = get_field("url", "link", "permalink", default="")

    return {
        "creator": creator,
        "platform": platform,
        "post_text": str(post_text)[:5000],
        "post_date": str(post_date),
        "engagement": {
            "likes": int(likes) if str(likes).isdigit() else 0,
            "comments": int(comments) if str(comments).isdigit() else 0,
            "shares": int(shares) if str(shares).isdigit() else 0,
            "views": int(views) if str(views).isdigit() else 0,
        },
        "media_type": str(media_type),
        "url": str(url),
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


def scrape_platform(platform, creators):
    """Scrape all creators for a given platform."""
    results = []
    endpoint_template = ENDPOINTS.get(platform)
    if not endpoint_template:
        print(f"[{platform}] No endpoint configured, skipping")
        return results

    for creator in creators:
        endpoint = endpoint_template.format(username=creator)
        print(f"[{platform}] Scraping @{creator} …")

        data = api_request(endpoint)
        if data is None:
            print(f"[{platform}] Failed to fetch @{creator}, skipping")
            continue

        # Save raw response
        raw_path = RAW_DIR / f"{platform}_{creator}.json"
        raw_path.write_text(json.dumps(data, indent=2))

        # Extract posts from response (API may nest them differently)
        posts = []
        if isinstance(data, list):
            posts = data
        elif isinstance(data, dict):
            posts = data.get("posts", data.get("tweets", data.get("videos",
                    data.get("items", data.get("data", [])))))
            if isinstance(posts, dict):
                posts = [posts]

        for raw_post in posts:
            if isinstance(raw_post, dict):
                normalized = normalize_post(raw_post, creator, platform)
                if normalized["post_text"]:  # skip empty posts
                    results.append(normalized)

        print(f"[{platform}] Got {len(posts)} posts from @{creator}")
        time.sleep(REQUEST_DELAY)

    return results


def run():
    """Main entry point."""
    ensure_dirs()
    print("=== Scrape Creators ===\n")

    if not API_KEY:
        print("[error] SCRAPE_CREATORS_API_KEY not set in .env")
        print("[info] Sign up at https://scrapecreators.com for an API key")
        print("[info] Generating sample data for dashboard demo …\n")
        # Generate sample data so the pipeline can continue
        sample = generate_sample_data()
        OUTPUT_FILE.write_text(json.dumps(sample, indent=2))
        print(f"[done] {len(sample)} sample posts written to {OUTPUT_FILE}")
        return sample

    all_content = []

    for platform, creators_env in PLATFORMS.items():
        creators = parse_creators(creators_env)
        if not creators:
            print(f"[{platform}] No creators configured, skipping")
            continue
        print(f"\n--- {platform.upper()} ({len(creators)} creators) ---")
        results = scrape_platform(platform, creators)
        all_content.extend(results)

    # Save normalized output
    OUTPUT_FILE.write_text(json.dumps(all_content, indent=2))
    print(f"\n[done] {len(all_content)} posts written to {OUTPUT_FILE}")
    return all_content


def generate_sample_data():
    """Generate realistic sample data for testing/demo when no API key is set."""
    niche = os.getenv("CONTENT_NICHE", "marketing")
    now = datetime.now(timezone.utc).isoformat()

    samples = [
        {
            "creator": "sample_creator_1",
            "platform": "twitter",
            "post_text": f"The biggest shift in {niche} this year isn't what you think. It's not AI. It's not automation. It's the return to authentic, human-first content. Here's why that matters for your strategy:",
            "post_date": now,
            "engagement": {"likes": 2847, "comments": 234, "shares": 891, "views": 148000},
            "media_type": "text",
            "url": "https://example.com/post1",
            "scraped_at": now,
        },
        {
            "creator": "sample_creator_2",
            "platform": "linkedin",
            "post_text": f"I spent 6 months testing every {niche} tool on the market.\n\nHere are my top 5 findings:\n\n1. Most tools solve problems you don't have\n2. The best ROI comes from fundamentals, not fancy tech\n3. Consistency beats complexity every single time\n4. Your audience doesn't care about your tech stack\n5. The winner is always the one who ships fastest\n\nStop optimizing. Start publishing.",
            "post_date": now,
            "engagement": {"likes": 5621, "comments": 487, "shares": 1203, "views": 320000},
            "media_type": "text",
            "url": "https://example.com/post2",
            "scraped_at": now,
        },
        {
            "creator": "sample_creator_1",
            "platform": "instagram",
            "post_text": f"POV: You finally stopped overthinking your {niche} strategy and just started creating.\n\nThe results? 3x engagement in 30 days.\n\nHere's exactly what I changed (save this):\n\n1. Posted daily instead of weekly\n2. Led with stories, not stats\n3. Asked questions in every caption\n4. Replied to every comment within 1 hour\n5. Stopped chasing trends, started setting them",
            "post_date": now,
            "engagement": {"likes": 12400, "comments": 876, "shares": 2100, "views": 89000},
            "media_type": "carousel",
            "url": "https://example.com/post3",
            "scraped_at": now,
        },
        {
            "creator": "sample_creator_3",
            "platform": "tiktok",
            "post_text": f"Wait for it… the one {niche} hack that nobody talks about. Most people spend hours on research. I spend 10 minutes. Here's my exact process.",
            "post_date": now,
            "engagement": {"likes": 45000, "comments": 3200, "shares": 8900, "views": 1200000},
            "media_type": "video",
            "url": "https://example.com/post4",
            "scraped_at": now,
        },
        {
            "creator": "sample_creator_2",
            "platform": "twitter",
            "post_text": f"Unpopular opinion: {niche} courses are a waste of money in 2026.\n\nEverything you need is free:\n- YouTube tutorials\n- Reddit communities\n- Open source tools\n- Free newsletters\n\nThe real skill? Filtering signal from noise.",
            "post_date": now,
            "engagement": {"likes": 8900, "comments": 1100, "shares": 3400, "views": 560000},
            "media_type": "text",
            "url": "https://example.com/post5",
            "scraped_at": now,
        },
    ]
    return samples


if __name__ == "__main__":
    run()
