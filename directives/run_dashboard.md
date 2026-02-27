# Directive: Run Local Dashboard

## Goal

Serve a local web dashboard that displays all generated content, trending
topics, and analytics in a visually appealing browser interface.

## Inputs

- `dashboard/data/generated_content.json` — generated posts
- `.tmp/trends.json` — trending topics
- `.tmp/analysis.json` — content analysis
- `DASHBOARD_HOST` and `DASHBOARD_PORT` from `.env`

## Process

1. Copy latest data files to `dashboard/data/`
2. Start the HTTP server
3. Serve the dashboard at `http://{host}:{port}`
4. Dashboard auto-refreshes when new data is available

## Execution Script

`execution/dashboard_server.py`

## Dashboard Sections

1. **Overview** — Summary stats: total posts generated, trends tracked, creators monitored
2. **Trending Topics** — Visual cards showing today's trends with scores
3. **Generated Content** — Filterable by platform, copy-to-clipboard buttons
4. **Creator Insights** — Top-performing creator content and patterns
5. **Content Calendar** — View generated content organized by date

## Outputs

- Running web server at configured host:port
- Dashboard accessible via browser

## Edge Cases

- If data files don't exist, show "No data yet — run the pipeline first"
- If port is in use, try port+1, port+2, etc.
- Dashboard should work offline (no external CDN dependencies)
