# OpenClaw Systems Dashboard

Local-only web dashboard that displays live system state from a local OpenClaw installation.

## Quick Start

```bash
cd /.openclaw/workspace/openclaw-systems-dashboard
npm install
npm start        # or: npm run dev
```

Open **http://127.0.0.1:8789** in your browser.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DASHBOARD_PORT` | `8789` | Port the dashboard listens on |
| `OPENCLAW_BIN` | `openclaw` | Path to the OpenClaw CLI binary |

Example:

```bash
DASHBOARD_PORT=9000 OPENCLAW_BIN=/usr/local/bin/openclaw npm start
```

## Architecture

```
Browser  ←→  Express (127.0.0.1:8789)  ←→  OpenClaw CLI (execFile)
```

- **Backend** (`server/`) — Node.js + Express. Runs CLI commands from a strict allowlist, caches results for 5 s, redacts secrets, and serves a single `/api/summary` JSON endpoint.
- **Frontend** (`public/`) — Static HTML/CSS/JS. Polls `/api/summary` every 15 s with exponential backoff on failure (caps at 2 min). Shows a "STALE" indicator after 3 consecutive failures.

## API

### `GET /api/summary`

Returns a single JSON object with all dashboard data:

```json
{
  "generatedAt": "...",
  "agentName": "...",
  "gateway": { "running": true, "bind": "127.0.0.1", "port": 3000, "pid": 12345, "rpcOk": true },
  "stats": { "modelsCount": 5, "cronCount": 6, "channelsCount": 2, "sessionLife": "24h" },
  "models": [],
  "cronJobs": [],
  "channels": [],
  "pipeline": [],
  "features": [],
  "health": { "state": "ok", "reasons": [] }
}
```

See `sample-payload.json` for a full example.

## Model Stack Override

If the OpenClaw CLI doesn't provide enough model detail, edit `server/model-stack.override.json` to supplement display information. **Never put secrets in this file.**

## Security

- Binds exclusively to `127.0.0.1` — refuses to start otherwise.
- Redacts any fields matching `token`, `secret`, `key`, `password`, `cookie`, `oauth`, `authorization`, `bearer`, plus long random/base64 strings.
- The browser never contacts the OpenClaw gateway directly.
- CLI commands are executed via `execFile` from a strict allowlist (no shell interpolation).

## Auto-Refresh Behaviour

| Condition | Interval |
|---|---|
| Normal | 15 s |
| After 1 failure | 30 s |
| After 2 failures | 60 s |
| After 3+ failures | 120 s (cap) + "STALE" badge |
| Recovery | Resets to 15 s immediately |

## Project Structure

```
openclaw-systems-dashboard/
├── package.json
├── README.md
├── sample-payload.json
├── server/
│   ├── index.js               # Express server entry point
│   ├── collector.js            # CLI data collection + summary builder
│   ├── cache.js                # In-memory TTL cache (5 s)
│   ├── redactor.js             # Secret redaction layer
│   └── model-stack.override.json
└── public/
    ├── index.html              # Dashboard HTML
    ├── style.css               # Dashboard styles
    └── app.js                  # Frontend polling + rendering
```
