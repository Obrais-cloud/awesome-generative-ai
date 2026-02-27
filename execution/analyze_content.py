#!/usr/bin/env python3
"""
Analyze Content — Layer 3 Execution Script

Cross-references trending topics with scraped creator content to identify
patterns, content gaps, and high-performing formats. Outputs actionable
insights for content generation.

Usage:
  python execution/analyze_content.py
"""

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

NICHE = os.getenv("CONTENT_NICHE", "marketing")
TMP_DIR = Path(".tmp")
TRENDS_FILE = TMP_DIR / "trends.json"
CREATOR_FILE = TMP_DIR / "creator_content.json"
OUTPUT_FILE = TMP_DIR / "analysis.json"


def load_json(path):
    """Load a JSON file, return empty list/dict on failure."""
    if not path.exists():
        print(f"[warn] {path} not found")
        return []
    try:
        data = json.loads(path.read_text())
        return data if data else []
    except json.JSONDecodeError as e:
        print(f"[error] Failed to parse {path}: {e}")
        return []


# ---------------------------------------------------------------------------
# Analysis functions
# ---------------------------------------------------------------------------
def compute_engagement_rate(post):
    """Compute a normalized engagement score for a post."""
    eng = post.get("engagement", {})
    likes = eng.get("likes", 0)
    comments = eng.get("comments", 0)
    shares = eng.get("shares", 0)
    views = eng.get("views", 0)

    # Weighted engagement: comments > shares > likes
    weighted = likes + (comments * 3) + (shares * 2)

    # Normalize by views if available
    if views > 0:
        return round(weighted / views, 4)
    # Fallback: raw weighted score normalized to rough scale
    return round(min(1.0, weighted / 10000), 4)


def extract_hook(text):
    """Extract the first line / hook from post text."""
    if not text:
        return ""
    lines = text.strip().split("\n")
    hook = lines[0].strip()
    # Clean up common prefixes
    hook = re.sub(r"^(POV:|THREAD:|BREAKING:|Hot take:)\s*", "", hook, flags=re.IGNORECASE)
    return hook[:200]


def extract_hashtags(text):
    """Extract hashtags from post text."""
    if not text:
        return []
    return re.findall(r"#(\w+)", text)


def analyze_hooks(posts):
    """Identify common hook patterns from top-performing posts."""
    hooks = []
    for p in posts:
        hook = extract_hook(p.get("post_text", ""))
        if hook:
            hooks.append(hook)

    # Categorize hook types
    patterns = Counter()
    for h in hooks:
        h_lower = h.lower()
        if "?" in h:
            patterns["question"] += 1
        elif any(w in h_lower for w in ["unpopular", "hot take", "controversial"]):
            patterns["controversial_take"] += 1
        elif any(w in h_lower for w in ["here's", "here are", "this is"]):
            patterns["direct_value"] += 1
        elif any(w in h_lower for w in ["i spent", "i tested", "i tried"]):
            patterns["personal_story"] += 1
        elif any(w in h_lower for w in ["stop", "don't", "never"]):
            patterns["negative_command"] += 1
        elif any(w in h_lower for w in ["the biggest", "the #1", "the most"]):
            patterns["superlative"] += 1
        else:
            patterns["statement"] += 1

    return hooks[:10], dict(patterns.most_common(5))


def find_trending_gaps(trends, posts):
    """Find trending topics not well covered by creators."""
    gaps = []
    post_texts = " ".join(p.get("post_text", "").lower() for p in posts)

    for trend in trends:
        topic = trend.get("topic", "")
        keywords = trend.get("keywords", [])

        # Check how many keywords appear in creator content
        matches = sum(1 for kw in keywords if kw.lower() in post_texts)
        coverage = matches / max(len(keywords), 1)

        # High trend score + low coverage = big opportunity
        trend_score = trend.get("score", 0.5)
        opportunity = round(trend_score * (1 - coverage), 2)

        gaps.append({
            "topic": topic,
            "trend_score": trend_score,
            "creator_coverage": round(coverage, 2),
            "opportunity_score": opportunity,
        })

    gaps.sort(key=lambda x: x["opportunity_score"], reverse=True)
    return gaps


def analyze_content_patterns(posts):
    """Extract statistical patterns from creator content."""
    if not posts:
        return {
            "avg_post_length": 0,
            "top_hooks": [],
            "top_hashtags": [],
            "best_media_types": [],
            "best_posting_times": [],
            "hook_patterns": {},
        }

    # Post lengths
    lengths = [len(p.get("post_text", "")) for p in posts]
    avg_length = round(sum(lengths) / len(lengths)) if lengths else 0

    # Hashtags
    all_hashtags = []
    for p in posts:
        all_hashtags.extend(extract_hashtags(p.get("post_text", "")))
    top_hashtags = [tag for tag, _ in Counter(all_hashtags).most_common(15)]

    # Media types by engagement
    media_engagement = {}
    for p in posts:
        mt = p.get("media_type", "text")
        rate = compute_engagement_rate(p)
        if mt not in media_engagement:
            media_engagement[mt] = []
        media_engagement[mt].append(rate)

    best_media = sorted(
        media_engagement.keys(),
        key=lambda m: sum(media_engagement[m]) / len(media_engagement[m]),
        reverse=True,
    )

    # Hooks
    top_hooks, hook_patterns = analyze_hooks(posts)

    # Platform distribution
    platform_counts = Counter(p.get("platform", "unknown") for p in posts)

    return {
        "avg_post_length": avg_length,
        "top_hooks": top_hooks,
        "top_hashtags": top_hashtags,
        "best_media_types": best_media[:5],
        "best_posting_times": ["9:00 AM", "12:00 PM", "6:00 PM"],  # placeholder
        "hook_patterns": hook_patterns,
        "platform_distribution": dict(platform_counts),
        "total_posts_analyzed": len(posts),
    }


def find_top_performing(posts, limit=10):
    """Rank posts by engagement and explain why they work."""
    scored = []
    for p in posts:
        rate = compute_engagement_rate(p)
        hook = extract_hook(p.get("post_text", ""))

        # Simple "why it works" analysis
        reasons = []
        text = p.get("post_text", "")
        if "?" in text:
            reasons.append("Uses questions to drive engagement")
        if len(text.split("\n")) > 3:
            reasons.append("Well-structured with line breaks")
        if any(c.isdigit() for c in text):
            reasons.append("Includes specific numbers/data")
        if len(text) > 500:
            reasons.append("Long-form content provides depth")
        if hook and len(hook) < 80:
            reasons.append("Short, punchy hook grabs attention")
        eng = p.get("engagement", {})
        if eng.get("shares", 0) > eng.get("likes", 0) * 0.3:
            reasons.append("High share ratio — content worth spreading")
        if not reasons:
            reasons.append("Strong topic relevance for the niche")

        scored.append({
            "creator": p.get("creator", "unknown"),
            "platform": p.get("platform", "unknown"),
            "post_text": text[:500],
            "engagement_rate": rate,
            "engagement": p.get("engagement", {}),
            "why_it_works": "; ".join(reasons[:3]),
            "hook": hook,
        })

    scored.sort(key=lambda x: x["engagement_rate"], reverse=True)
    return scored[:limit]


def generate_recommendations(gaps, patterns, top_posts):
    """Generate actionable content recommendations."""
    recs = []

    # Based on trending gaps
    if gaps:
        top_gap = gaps[0]
        recs.append(
            f"Top opportunity: Create content about '{top_gap['topic']}' — "
            f"trending at {top_gap['trend_score']:.0%} but only "
            f"{top_gap['creator_coverage']:.0%} creator coverage."
        )

    # Based on patterns
    if patterns.get("hook_patterns"):
        best_hook = max(patterns["hook_patterns"], key=patterns["hook_patterns"].get)
        recs.append(f"Best performing hook style: {best_hook.replace('_', ' ')} — use this format for higher engagement.")

    if patterns.get("best_media_types"):
        recs.append(f"Top media format: {patterns['best_media_types'][0]} — prioritize this content type.")

    if patterns.get("avg_post_length", 0) > 0:
        recs.append(f"Optimal post length: ~{patterns['avg_post_length']} characters based on top performers.")

    if patterns.get("top_hashtags"):
        top_tags = ", ".join(f"#{t}" for t in patterns["top_hashtags"][:5])
        recs.append(f"Trending hashtags to use: {top_tags}")

    # Based on top posts
    if top_posts:
        recs.append(
            f"Study @{top_posts[0]['creator']}'s style on {top_posts[0]['platform']} — "
            f"highest engagement rate ({top_posts[0]['engagement_rate']:.2%})."
        )

    # General best practices
    recs.append("Post consistently — daily content outperforms sporadic posting by 3-5x.")
    recs.append("Engage with comments within 1 hour of posting for maximum algorithmic boost.")

    return recs


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run():
    """Main entry point."""
    print(f"=== Analyze Content for niche: '{NICHE}' ===\n")

    trends = load_json(TRENDS_FILE)
    posts = load_json(CREATOR_FILE)

    if not trends and not posts:
        print("[error] No data to analyze. Run research_trends.py and scrape_creators.py first.")
        return None

    print(f"[data] {len(trends)} trends, {len(posts)} creator posts loaded\n")

    # Run analyses
    print("[1/4] Finding trending gaps …")
    gaps = find_trending_gaps(trends, posts)

    print("[2/4] Analyzing content patterns …")
    patterns = analyze_content_patterns(posts)

    print("[3/4] Ranking top-performing content …")
    top_posts = find_top_performing(posts)

    print("[4/4] Generating recommendations …")
    recommendations = generate_recommendations(gaps, patterns, top_posts)

    # Build output
    analysis = {
        "trending_gaps": gaps[:15],
        "top_performing_content": top_posts,
        "content_patterns": patterns,
        "recommendations": recommendations,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "niche": NICHE,
        "data_sources": {
            "trends_count": len(trends),
            "posts_count": len(posts),
        },
    }

    OUTPUT_FILE.write_text(json.dumps(analysis, indent=2))
    print(f"\n[done] Analysis written to {OUTPUT_FILE}")
    print(f"  - {len(gaps)} trending gaps identified")
    print(f"  - {len(top_posts)} top-performing posts ranked")
    print(f"  - {len(recommendations)} recommendations generated")

    return analysis


if __name__ == "__main__":
    run()
