#!/usr/bin/env python3
"""
Research Trends — Layer 3 Execution Script

Scans multiple sources to identify trending topics within the configured niche.
Outputs a scored, deduplicated list of trends to .tmp/trends.json.

Sources:
  1. Google Trends RSS feed
  2. Reddit subreddit posts (JSON API)

Usage:
  python execution/research_trends.py
"""

import json
import os
import sys
import time
import hashlib
from datetime import datetime, timezone
from pathlib import Path

import feedparser
import requests
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

NICHE = os.getenv("CONTENT_NICHE", "marketing")
TMP_DIR = Path(".tmp")
CACHE_FILE = TMP_DIR / "trends_cache.json"
OUTPUT_FILE = TMP_DIR / "trends.json"
CACHE_TTL_SECONDS = 3600  # 1 hour

# Reddit config
REDDIT_USER_AGENT = "ContentMachine/1.0 (research bot)"
REDDIT_DELAY = 2  # seconds between requests

# Subreddit mappings per niche (extensible)
NICHE_SUBREDDITS = {
    "marketing": ["marketing", "digitalmarketing", "socialmedia", "SEO", "content_marketing"],
    "ai": ["artificial", "MachineLearning", "ChatGPT", "LocalLLaMA", "singularity"],
    "fitness": ["fitness", "bodybuilding", "running", "nutrition", "weightroom"],
    "tech": ["technology", "programming", "webdev", "startups", "SaaS"],
    "finance": ["finance", "investing", "stocks", "CryptoCurrency", "personalfinance"],
    "design": ["design", "graphic_design", "UI_Design", "web_design", "UXDesign"],
}


def ensure_dirs():
    """Create necessary directories."""
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    (TMP_DIR / "raw").mkdir(parents=True, exist_ok=True)


def check_cache():
    """Return cached trends if still valid, else None."""
    if not CACHE_FILE.exists():
        return None
    try:
        data = json.loads(CACHE_FILE.read_text())
        cached_at = datetime.fromisoformat(data.get("cached_at", "2000-01-01"))
        age = (datetime.now(timezone.utc) - cached_at.replace(tzinfo=timezone.utc)).total_seconds()
        if age < CACHE_TTL_SECONDS:
            print(f"[cache] Using cached trends ({int(age)}s old, TTL={CACHE_TTL_SECONDS}s)")
            return data.get("trends", [])
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def save_cache(trends):
    """Persist trends to cache file."""
    payload = {
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "trends": trends,
    }
    CACHE_FILE.write_text(json.dumps(payload, indent=2))


# ---------------------------------------------------------------------------
# Source 1: Google Trends RSS
# ---------------------------------------------------------------------------
def fetch_google_trends():
    """Fetch daily trending searches from Google Trends RSS."""
    url = "https://trends.google.com/trending/rss?geo=US"
    print(f"[google] Fetching Google Trends RSS …")
    try:
        feed = feedparser.parse(url)
        trends = []
        for entry in feed.entries[:20]:
            title = entry.get("title", "").strip()
            if not title:
                continue
            # Compute relevance to niche via simple keyword overlap
            niche_keywords = set(NICHE.lower().split())
            title_words = set(title.lower().split())
            summary = entry.get("summary", entry.get("description", ""))
            summary_words = set(summary.lower().split()) if summary else set()
            all_words = title_words | summary_words
            overlap = len(niche_keywords & all_words)
            relevance = min(1.0, 0.3 + (overlap * 0.3))  # base 0.3, boost per match

            trends.append({
                "topic": title,
                "score": round(relevance, 2),
                "sources": ["google_trends"],
                "keywords": list(title_words)[:10],
                "summary": summary[:300] if summary else f"Trending on Google: {title}",
                "discovered_at": datetime.now(timezone.utc).isoformat(),
            })
        print(f"[google] Found {len(trends)} trends")
        return trends
    except Exception as e:
        print(f"[google] Error fetching Google Trends: {e}")
        return []


# ---------------------------------------------------------------------------
# Source 2: Reddit
# ---------------------------------------------------------------------------
def fetch_reddit_trends():
    """Fetch hot posts from niche-related subreddits."""
    subreddits = NICHE_SUBREDDITS.get(NICHE.lower(), [NICHE])
    all_posts = []
    session = requests.Session()
    session.headers.update({"User-Agent": REDDIT_USER_AGENT})

    for sub in subreddits:
        url = f"https://www.reddit.com/r/{sub}/hot.json?limit=10"
        print(f"[reddit] Fetching r/{sub} …")
        try:
            resp = session.get(url, timeout=15)
            if resp.status_code == 429:
                print(f"[reddit] Rate limited on r/{sub}, skipping")
                time.sleep(REDDIT_DELAY * 2)
                continue
            resp.raise_for_status()
            data = resp.json()

            # Save raw response
            raw_path = TMP_DIR / "raw" / f"reddit_{sub}.json"
            raw_path.write_text(json.dumps(data, indent=2))

            for post in data.get("data", {}).get("children", []):
                pdata = post.get("data", {})
                title = pdata.get("title", "").strip()
                if not title or pdata.get("stickied"):
                    continue
                ups = pdata.get("ups", 0)
                comments = pdata.get("num_comments", 0)
                engagement = ups + (comments * 2)
                # Normalize score 0-1 (rough: top posts ~5000+ engagement)
                score = round(min(1.0, engagement / 5000), 2)

                all_posts.append({
                    "topic": title,
                    "score": score,
                    "sources": ["reddit"],
                    "keywords": list(set(title.lower().split()))[:10],
                    "summary": f"Hot on r/{sub} — {ups} upvotes, {comments} comments",
                    "discovered_at": datetime.now(timezone.utc).isoformat(),
                    "subreddit": sub,
                    "engagement": engagement,
                })
        except Exception as e:
            print(f"[reddit] Error fetching r/{sub}: {e}")
        time.sleep(REDDIT_DELAY)

    # Sort by engagement and take top 15
    all_posts.sort(key=lambda x: x.get("engagement", 0), reverse=True)
    print(f"[reddit] Found {len(all_posts)} posts across {len(subreddits)} subreddits")
    return all_posts[:15]


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------
def deduplicate(trends):
    """Merge duplicate topics by fuzzy title matching."""
    seen = {}
    merged = []
    for t in trends:
        # Simple dedup: normalize title to lowercase, strip punctuation
        key = "".join(c for c in t["topic"].lower() if c.isalnum() or c == " ").strip()
        short_key = key[:50]
        if short_key in seen:
            # Merge: combine sources, take higher score
            existing = seen[short_key]
            existing["score"] = round(max(existing["score"], t["score"]), 2)
            for src in t["sources"]:
                if src not in existing["sources"]:
                    existing["sources"].append(src)
            for kw in t.get("keywords", []):
                if kw not in existing["keywords"]:
                    existing["keywords"].append(kw)
        else:
            seen[short_key] = t
            merged.append(t)
    return merged


def run():
    """Main entry point."""
    ensure_dirs()
    print(f"=== Research Trends for niche: '{NICHE}' ===\n")

    # Check cache first
    cached = check_cache()
    if cached:
        OUTPUT_FILE.write_text(json.dumps(cached, indent=2))
        print(f"\n[done] {len(cached)} trends written to {OUTPUT_FILE}")
        return cached

    # Fetch from all sources
    google = fetch_google_trends()
    reddit = fetch_reddit_trends()

    # Combine and deduplicate
    all_trends = google + reddit
    all_trends = deduplicate(all_trends)

    # Sort by score descending
    all_trends.sort(key=lambda x: x["score"], reverse=True)

    # Ensure minimum 5 trends
    if len(all_trends) < 5:
        print(f"[warn] Only {len(all_trends)} trends found, padding with generic niche topics")
        while len(all_trends) < 5:
            all_trends.append({
                "topic": f"Latest developments in {NICHE}",
                "score": 0.1,
                "sources": ["fallback"],
                "keywords": NICHE.lower().split(),
                "summary": f"General {NICHE} industry update",
                "discovered_at": datetime.now(timezone.utc).isoformat(),
            })

    # Remove internal fields before saving
    for t in all_trends:
        t.pop("subreddit", None)
        t.pop("engagement", None)

    # Save
    OUTPUT_FILE.write_text(json.dumps(all_trends, indent=2))
    save_cache(all_trends)
    print(f"\n[done] {len(all_trends)} trends written to {OUTPUT_FILE}")
    return all_trends


if __name__ == "__main__":
    run()
