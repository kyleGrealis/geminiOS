# geminiOS

A native, lightweight, sandboxed, and near-zero latency Discord AI assistant running natively under systemd on a Raspberry Pi 5.

This project replaces complex container/MCP layers with a single persistent Node.js ESM daemon communicating directly with the Discord Gateway.

## Directory Structure

```text
geminiOS/
├── package.json         # Runtime dependencies (discord.js, @google/genai, js-yaml, better-sqlite3)
├── .env                 # API Keys and system configuration (git-ignored)
├── config/
│   ├── andy-persona.md  # System instructions (hot-reloaded on every turn)
│   └── permissions.yaml # Declares default/channel models, thinking configs, and command blacklists
├── blueprints/          # Prompt templates for scheduled tasks (weather, lessons, briefings)
├── data/
│   └── andy.db          # WAL SQLite database hosting task scheduling tables and tool audit logs
├── keys/
│   ├── andy_ed25519     # Dedicated SSH private key for remote hosts execution
│   └── config           # Localized SSH configuration profile mapping remote host IPs
├── scripts/
│   └── link-systemd.sh  # Script to symlink deploy unit and reload user systemd
├── deploy/
│   └── systemd/
│       └── geminios.service # Hardened user namespace systemd unit
└── src/
    ├── index.ts         # Bootstraps client connections and sweep schedules
    ├── bot.ts           # Discord WebSocket listener, prompt sanitizers, and response chunkers
    ├── agent.ts         # Gemini GenAI SDK caller (handles reasoning budgets and tool-execution loops)
    ├── tools.ts         # Gated tools (Gmail, Drive, Calendar, memory retrieval, web search, screenshots)
    ├── scheduler.ts     # Flat, time-zone aware SQLite task sweep engine
    └── db.ts            # WAL SQLite database initializer
```

## Setup & Deployment

1. **Clone & Install Dependencies:**
   ```bash
   pnpm install
   ```
2. **Environment Variables:**
   Create a `.env` file in the root with:
   ```env
   DISCORD_BOT_TOKEN=your_token
   GEMINI_API_KEY=your_gemini_api_key
   ```
3. **Link & Start systemd User Unit:**
   ```bash
   chmod +x scripts/link-systemd.sh
   ./scripts/link-systemd.sh
   systemctl --user start geminios
   ```
4. **Enable Boot Persistence:**
   Ensure your systemd user services persist after logout:
   ```bash
   loginctl enable-linger kyle
   ```

## Key Commands
* **Start Dev Server (auto-reload):** `pnpm run dev`
* **Inspect Tool Logs / Database:** `pnpm run inspect`
* **Check Service Journal logs:** `journalctl --user -u geminios -n 100 -f`
