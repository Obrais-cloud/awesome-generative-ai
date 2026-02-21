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
| `DASHBOARD_HOST` | `127.0.0.1` | Bind address (`0.0.0.0` for remote access) |
| `DASHBOARD_TOKEN` | *(none)* | Access token (**required** when using remote mode) |
| `OPENCLAW_BIN` | `openclaw` | Path to the OpenClaw CLI binary |

### Local mode (default)

```bash
npm start
# → http://127.0.0.1:8789  (no token needed)
```

### Remote mode (access from another machine)

```bash
DASHBOARD_HOST=0.0.0.0 DASHBOARD_TOKEN=my-secret-token-123 npm start
# → http://<server-ip>:8789  (token required for all API calls)
```

Open the dashboard from any machine on your network. You'll be prompted to enter the token on first load.

### Custom port + binary path

```bash
DASHBOARD_PORT=9000 OPENCLAW_BIN=/usr/local/bin/openclaw npm start
```

## Architecture

```
Browser  ←→  Express (127.0.0.1:8789)  ←→  OpenClaw CLI (execFile)
```

- **Backend** (`server/`) — Node.js + Express. Runs CLI commands from a strict allowlist, caches results for 5 s, redacts secrets, and serves JSON endpoints for monitoring and control.
- **Frontend** (`public/`) — Static HTML/CSS/JS. Polls `/api/summary` every 15 s with exponential backoff on failure (caps at 2 min). Shows a "STALE" indicator after 3 consecutive failures.

## API

### `GET /api/summary`

Returns a single JSON object with all dashboard data (models, cron, channels, skills, pipeline, health, pending pairings).

### `GET /api/probe`

Quick connection health check — verifies the CLI binary is reachable and returns latency + version.

### `POST /api/action`

Execute a control action. Body: `{ "action": "<key>", "targetId": "<optional>" }`.

Available actions:

| Action | Description | Requires ID |
|---|---|---|
| `restart` | Restart the OpenClaw agent | No |
| `gatewayStart` | Start the gateway proxy | No |
| `gatewayRestart` | Restart the gateway proxy | No |
| `gatewayStop` | Stop the gateway proxy | No |
| `resetSession` | Reset the current session | No |
| `cronEnable` | Enable a cron job | Yes |
| `cronDisable` | Disable a cron job | Yes |
| `cronRunNow` | Trigger a cron job immediately | Yes |
| `channelReconnect` | Reconnect a channel | Yes |
| `channelLogin` | Re-login to a channel | Yes |
| `pairingApprove` | Approve a pending pairing | Yes |
| `doctorFix` | Auto-fix common issues | No |
| `skillInstall` | Install a skill from ClawHub | Yes |
| `skillUninstall` | Uninstall a skill | Yes |
| `skillUpdate` | Update all installed skills | No |

### `GET /api/logs`

Fetch the last 80 lines of OpenClaw logs (redacted).

### `POST /api/diagnose`

Run `openclaw doctor --json` diagnostics.

### `GET /api/status/deep`

Run `openclaw status --deep --json` for a comprehensive status report.

### `GET /api/skills`

Fetch the list of installed skills.

See `sample-payload.json` for a full example of `/api/summary` output.

## Model Stack Override

If the OpenClaw CLI doesn't provide enough model detail, edit `server/model-stack.override.json` to supplement display information. **Never put secrets in this file.**

## Security

- Defaults to `127.0.0.1` (local only). Remote mode (`0.0.0.0`) requires `DASHBOARD_TOKEN`.
- All API endpoints require `X-Dashboard-Token` header in remote mode (static assets are public so the login page can load).
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
