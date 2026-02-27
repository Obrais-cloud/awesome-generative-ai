#!/usr/bin/env python3
"""
Generate Content — Layer 3 Execution Script

Generates platform-optimized social media posts using trending topics,
content analysis, and AI (Anthropic Claude API). Falls back to template-based
generation when no API key is configured.

Usage:
  python execution/generate_content.py
"""

import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

NICHE = os.getenv("CONTENT_NICHE", "marketing")
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")
TMP_DIR = Path(".tmp")
TRENDS_FILE = TMP_DIR / "trends.json"
ANALYSIS_FILE = TMP_DIR / "analysis.json"
CREATOR_FILE = TMP_DIR / "creator_content.json"
OUTPUT_DIR = Path("dashboard/data")
OUTPUT_FILE = OUTPUT_DIR / "generated_content.json"

# Platforms to generate for
PLATFORMS = ["twitter", "linkedin", "instagram", "tiktok"]

# Platform constraints
PLATFORM_CONFIG = {
    "twitter": {
        "max_length": 280,
        "hashtag_count": 3,
        "tone": "punchy, conversational, hook-driven",
        "format": "short-form",
    },
    "linkedin": {
        "max_length": 1500,
        "hashtag_count": 5,
        "tone": "professional, insightful, storytelling",
        "format": "long-form with line breaks",
    },
    "instagram": {
        "max_length": 2200,
        "hashtag_count": 25,
        "tone": "engaging, visual-first, relatable",
        "format": "caption with hashtag block",
    },
    "tiktok": {
        "max_length": 500,
        "hashtag_count": 5,
        "tone": "energetic, casual, hook in first 3 seconds",
        "format": "video script with timestamps",
    },
}


def load_json(path):
    """Load JSON file, return empty list/dict on failure."""
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text()) or []
    except json.JSONDecodeError:
        return []


def ensure_dirs():
    """Create output directories."""
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# AI-powered generation (Anthropic Claude API)
# ---------------------------------------------------------------------------
def generate_with_claude(topic, platform, config, analysis_context):
    """Generate a post using Claude API."""
    try:
        import anthropic
    except ImportError:
        print("[warn] anthropic package not installed, falling back to templates")
        return None

    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)

    patterns = analysis_context.get("content_patterns", {})
    top_hooks = patterns.get("top_hooks", [])
    top_hashtags = patterns.get("top_hashtags", [])

    system_prompt = f"""You are an expert {NICHE} content creator. Generate a single social media post.

Rules:
- Platform: {platform}
- Max length: {config['max_length']} characters
- Tone: {config['tone']}
- Format: {config['format']}
- Include exactly {config['hashtag_count']} relevant hashtags
- The post must be original and provide real value
- Use hooks that stop the scroll — study these examples from top performers:
{chr(10).join(f'  - {h}' for h in top_hooks[:5])}

Return ONLY the post text, nothing else. No explanations, no labels."""

    user_prompt = f"""Create a {platform} post about this trending topic in {NICHE}:

Topic: {topic.get('topic', NICHE)}
Context: {topic.get('summary', 'Trending topic in ' + NICHE)}
Keywords: {', '.join(topic.get('keywords', [])[:10])}

Trending hashtags to consider: {', '.join(f'#{t}' for t in top_hashtags[:10])}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return response.content[0].text.strip()
    except Exception as e:
        print(f"  [claude] Error: {e}")
        return None


# ---------------------------------------------------------------------------
# Template-based generation (fallback)
# ---------------------------------------------------------------------------
TEMPLATES = {
    "twitter": [
        "{hook}\n\n{value}\n\n{cta}\n\n{hashtags}",
        "{hook}\n\nThread: {value}\n\n{cta} {hashtags}",
        "{question}\n\n{value}\n\n{hashtags}",
    ],
    "linkedin": [
        "{hook}\n\n{story}\n\n{takeaway}\n\n{cta}\n\n{hashtags}",
        "{hook}\n\n{value}\n\nKey insights:\n{bullets}\n\n{cta}\n\n{hashtags}",
    ],
    "instagram": [
        "{hook}\n\n{value}\n\n{cta}\n\n.\n.\n.\n{hashtags}",
        "{hook}\n\n{story}\n\nSave this for later!\n\n.\n.\n.\n{hashtags}",
    ],
    "tiktok": [
        "HOOK (0-3s): {hook}\nSETUP (3-10s): {setup}\nVALUE (10-45s): {value}\nCTA (45-60s): {cta}",
    ],
}

HOOKS = {
    "question": [
        f"What if everything you knew about {NICHE} was wrong?",
        f"Why do 90% of {NICHE} strategies fail?",
        f"Is your {NICHE} approach actually holding you back?",
        f"What's the #1 mistake in {NICHE} right now?",
    ],
    "controversial": [
        f"Unpopular opinion: most {NICHE} advice is outdated.",
        f"Hot take: {NICHE} is going to look completely different in 6 months.",
        f"Nobody wants to hear this about {NICHE}, but…",
    ],
    "value": [
        f"The {NICHE} hack that changed everything for me:",
        f"Here's what I learned from studying 100+ {NICHE} strategies:",
        f"3 {NICHE} lessons I wish I learned sooner:",
    ],
    "story": [
        f"6 months ago, my {NICHE} results were terrible. Here's what changed:",
        f"I tested every {NICHE} approach for 90 days. Results inside.",
    ],
}

CTAS = [
    "What's your take? Drop a comment below.",
    "Follow for more insights like this.",
    "Save this for later — you'll need it.",
    "Share this with someone who needs to hear it.",
    "Agree or disagree? Let me know.",
    "Tag someone who should see this.",
]


def generate_with_template(topic, platform, config, analysis_context):
    """Generate a post using templates and data-driven content."""
    import random

    templates = TEMPLATES.get(platform, TEMPLATES["twitter"])
    template = random.choice(templates)

    topic_name = topic.get("topic", NICHE)
    keywords = topic.get("keywords", [NICHE])
    summary = topic.get("summary", f"Trending in {NICHE}")

    # Pick hooks
    hook_style = random.choice(list(HOOKS.keys()))
    hook_list = HOOKS[hook_style]
    hook = random.choice(hook_list)
    # Inject topic into hook where relevant
    hook = hook.replace(NICHE, f"{NICHE} ({topic_name})" if topic_name != NICHE else NICHE)

    question = random.choice(HOOKS["question"])
    cta = random.choice(CTAS)

    # Build hashtags
    patterns = analysis_context.get("content_patterns", {}) if isinstance(analysis_context, dict) else {}
    top_hashtags = patterns.get("top_hashtags", keywords[:5])
    selected_tags = top_hashtags[:config["hashtag_count"]]
    hashtags = " ".join(f"#{t}" for t in selected_tags)

    # Value content
    value = f"The key insight about {topic_name}: {summary}"
    if len(value) > config["max_length"] // 2:
        value = value[:config["max_length"] // 2] + "…"

    # Story / setup
    story = f"I've been researching {topic_name} and found something surprising. {summary}"
    setup = f"Everyone's talking about {topic_name} right now. Here's why it matters."
    takeaway = f"The bottom line: {topic_name} is reshaping how we think about {NICHE}."

    # Bullets for LinkedIn
    bullets_list = [f"• {kw.title()}: a key factor in this trend" for kw in keywords[:4]]
    bullets = "\n".join(bullets_list)

    # Fill template
    post = template.format(
        hook=hook,
        question=question,
        value=value,
        story=story,
        setup=setup,
        takeaway=takeaway,
        cta=cta,
        hashtags=hashtags,
        bullets=bullets,
    )

    # Enforce max length
    if len(post) > config["max_length"]:
        # Trim value section while keeping hook and hashtags
        excess = len(post) - config["max_length"]
        post = post[:config["max_length"] - len(hashtags) - 5] + "…\n\n" + hashtags

    return post.strip()


# ---------------------------------------------------------------------------
# Main generation pipeline
# ---------------------------------------------------------------------------
def generate_for_topic(topic, analysis, use_ai=False):
    """Generate posts for all platforms for a given topic."""
    posts = []

    for platform in PLATFORMS:
        config = PLATFORM_CONFIG[platform]
        print(f"  [{platform}] Generating …")

        content = None
        if use_ai and ANTHROPIC_KEY:
            content = generate_with_claude(topic, platform, config, analysis)
            time.sleep(1)  # rate limiting

        if content is None:
            content = generate_with_template(topic, platform, config, analysis)

        # Extract hashtags from content
        import re
        found_hashtags = re.findall(r"#(\w+)", content)

        # Determine engagement estimate
        trend_score = topic.get("score", 0.5)
        if trend_score > 0.7:
            est_engagement = "high"
        elif trend_score > 0.4:
            est_engagement = "medium"
        else:
            est_engagement = "low"

        content_type = "script" if platform == "tiktok" else "caption" if platform == "instagram" else "text"

        posts.append({
            "id": str(uuid.uuid4()),
            "topic": topic.get("topic", NICHE),
            "trend_score": trend_score,
            "platform": platform,
            "content": content,
            "hashtags": found_hashtags,
            "content_type": content_type,
            "hook": content.split("\n")[0][:200],
            "estimated_engagement": est_engagement,
            "based_on_trend": topic.get("summary", ""),
            "generated_at": datetime.now(timezone.utc).isoformat(),
        })

    return posts


def run():
    """Main entry point."""
    ensure_dirs()
    print(f"=== Generate Content for niche: '{NICHE}' ===\n")

    # Load data
    trends = load_json(TRENDS_FILE)
    analysis = load_json(ANALYSIS_FILE)
    if isinstance(analysis, list):
        analysis = analysis[0] if analysis else {}

    if not trends:
        print("[warn] No trends found, generating generic content")
        trends = [{
            "topic": f"Latest {NICHE} trends",
            "score": 0.5,
            "keywords": NICHE.split(),
            "summary": f"General developments in {NICHE}",
        }]

    # Determine if we should use AI
    use_ai = bool(ANTHROPIC_KEY)
    mode = "AI-powered (Claude)" if use_ai else "Template-based"
    print(f"[mode] {mode} generation\n")

    # Select top topics (up to 5 with highest scores)
    # Prefer trends with high opportunity scores from analysis
    gaps = {}
    if isinstance(analysis, dict):
        for gap in analysis.get("trending_gaps", []):
            gaps[gap.get("topic", "")] = gap.get("opportunity_score", 0)

    # Score trends by combining trend score and opportunity
    for t in trends:
        opportunity = gaps.get(t.get("topic", ""), 0)
        t["combined_score"] = t.get("score", 0) + opportunity

    trends.sort(key=lambda x: x.get("combined_score", 0), reverse=True)
    selected = trends[:5]

    print(f"[topics] Selected {len(selected)} topics for content generation:\n")
    for i, t in enumerate(selected, 1):
        print(f"  {i}. {t.get('topic', '?')} (score: {t.get('combined_score', 0):.2f})")
    print()

    # Generate content
    all_posts = []
    for i, topic in enumerate(selected, 1):
        print(f"\n--- Topic {i}/{len(selected)}: {topic.get('topic', '?')} ---")
        posts = generate_for_topic(topic, analysis, use_ai=use_ai)
        all_posts.extend(posts)

    # Build output
    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "niche": NICHE,
        "generation_mode": mode,
        "topics_used": len(selected),
        "total_posts": len(all_posts),
        "posts": all_posts,
    }

    OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"\n[done] {len(all_posts)} posts generated across {len(PLATFORMS)} platforms")
    print(f"[done] Output saved to {OUTPUT_FILE}")

    return output


if __name__ == "__main__":
    run()
