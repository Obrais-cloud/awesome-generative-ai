#!/usr/bin/env python3
"""
Run Pipeline — Master Orchestrator Script

Runs the full content generation pipeline in sequence:
  1. Research trending topics
  2. Scrape creator content
  3. Analyze content and patterns
  4. Generate optimized social media posts
  5. (Optional) Launch the dashboard

Usage:
  python execution/run_pipeline.py              # Run full pipeline
  python execution/run_pipeline.py --no-scrape  # Skip scraping (use cached data)
  python execution/run_pipeline.py --dashboard   # Run pipeline + launch dashboard
"""

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Ensure project root is in path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))


def run_step(name, func):
    """Run a pipeline step with timing and error handling."""
    print(f"\n{'=' * 60}")
    print(f"  STEP: {name}")
    print(f"{'=' * 60}\n")
    start = time.time()
    try:
        result = func()
        elapsed = time.time() - start
        print(f"\n[OK] {name} completed in {elapsed:.1f}s")
        return result
    except Exception as e:
        elapsed = time.time() - start
        print(f"\n[FAIL] {name} failed after {elapsed:.1f}s: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    parser = argparse.ArgumentParser(description="Content Machine Pipeline")
    parser.add_argument(
        "--no-scrape", action="store_true",
        help="Skip the scraping step (use cached data)"
    )
    parser.add_argument(
        "--dashboard", action="store_true",
        help="Launch the dashboard after pipeline completes"
    )
    args = parser.parse_args()

    start_time = time.time()
    print(f"\n{'#' * 60}")
    print(f"  CONTENT MACHINE — Full Pipeline")
    print(f"  Started: {datetime.now(timezone.utc).isoformat()}")
    print(f"{'#' * 60}")

    # Step 1: Research trends
    from execution.research_trends import run as research_run
    run_step("Research Trending Topics", research_run)

    # Step 2: Scrape creators
    if not args.no_scrape:
        from execution.scrape_creators import run as scrape_run
        run_step("Scrape Creator Content", scrape_run)
    else:
        print("\n[skip] Scraping skipped (--no-scrape flag)")

    # Step 3: Analyze
    from execution.analyze_content import run as analyze_run
    run_step("Analyze Content", analyze_run)

    # Step 4: Generate
    from execution.generate_content import run as generate_run
    run_step("Generate Content", generate_run)

    total = time.time() - start_time
    print(f"\n{'#' * 60}")
    print(f"  PIPELINE COMPLETE — {total:.1f}s total")
    print(f"{'#' * 60}\n")

    # Step 5: Dashboard
    if args.dashboard:
        from execution.dashboard_server import run as dashboard_run
        print("[info] Launching dashboard …\n")
        dashboard_run()


if __name__ == "__main__":
    main()
