# geminiOS User Manual & Operator Guide

Welcome to the operator manual for **geminiOS**, your native, sandboxed, low-latency companion daemon. This guide covers how to interact with Andy, customize his features, and maintain his execution sandboxing.

---

## 1. Interaction Models & Channel Hats

Andy operates under channel-specific rules defined in `config/permissions.yaml`. 

* **No Ping Needed:** In specific whitelisted channels (`#main`, `#weather`, `#news`, `#misc`, `#typescript`, `#devops`, `#logs`, `#issues`), Andy monitors chat history and responds automatically to messages without requiring an `@mention`.
* **Hot-Reloadable Config:** You can edit models and settings in `config/permissions.yaml` on the fly. Andy checks file modification stamps on every turn and loads updates without needing a service restart.

### Channel Mappings (permissions.yaml)
* **`#main` & `#misc` (gemini-3.1-flash-lite):** Configured with low-latency models for rapid conversational exchanges.
* **`#typescript` & `#weather` (gemini-3.5-flash):** Configured with the latest production Flash model for high-instruction fidelity, structured lesson parsing, and complex weather calculations.
* **`#devops` (gemini-3.1-pro-preview):** Configured with the reasoning model and a thinking budget (`thinking_level: 1`) to ensure safety and precision when running shell operations.

---

## 2. Using Gated Tools

Andy has access to a secure toolset matching his system instruction mandates:

### 🔍 Web Search & Page Screenshotting
Andy can search the web and capture live webpage images for you:
* **Web Search:** Prompt Andy to lookup current topics: *"Andy, what is the latest release date of Node.js v24?"*. He will execute a grounded sub-query through Google Search.
* **Screenshots:** Ask Andy to snap a page: *"Andy, capture https://news.ycombinator.com and post it."*. He will stream the PNG directly to your Discord channel.
* **Combined Flow:** You can chain these commands: *"Andy, search the web to find the URL for the Tailwind docs, then screenshot it."*

### 💾 Obsidian Memory (recall_memory & save_memory)
Andy manages facts and connections inside your personal Obsidian Vault:
* **Recall Memory:** Searches your vault (under `AndyMemory/` and `dev/AI-Knowledge-Base/`). Queries are automatically parsed into keyword components to perform AND-based matches.
* **Save Memory:** Appends new facts dynamically to markdown shards inside your Obsidian Vault under `AndyMemory/<slug>.md`.

### 📧 Google Workspace Integration
Andy interacts directly with your Google Workspace accounts using lightweight REST API fetches:
* **Gmail:** Scans and summarizes unread messages (`google_gmail_list_messages` and `google_gmail_get_message`).
* **Drive:** Searches for files or folders (`google_drive_list_files`).
* **Calendar:** Reads calendar timelines (`google_calendar_list_events`).

### 💻 Remote SSH Command Execution
Andy can connect passwordlessly to your configured remote development host:
* **Under the Hood:** Executes command strings over SSH using the keys and configs under `./keys/`.
* **Security Filter:** Commands are parsed and filtered locally. If the command string includes any restricted keywords (like `rm` or `sudo`), the local gateway blocks execution immediately, preventing remote system damage.

---

## 3. Scheduled Tasks & Sweeper Engine

The sweeper daemon (`src/scheduler.ts`) ticks every 30 seconds to evaluate scheduled jobs inside `andy.db`.

### Default Tasks
* **6:30 AM Daily:** Weather forecast sent to `#weather` (queries Calendar first to check if you are travelling, automatically adjusting location coords if a travel event is found).
* **7:00 AM Mon-Fri:** Morning briefing report sent to `#main`.
* **8:00 AM Mon-Fri:** TypeScript Lesson sent to `#typescript`.
* **9:00 PM Daily:** Evening weather update.

### Smart Lesson Pausing & Configurations
The scheduler reads overrides from `~/.gemini/state/task-config.json`.
* You can tell Andy: *"Andy, pause the TypeScript lessons until I get back from Chicago"* or *"Pause lessons until June 5th."*
* Andy will check your Calendar for travel events, calculate the resume date, update the JSON config state, and pause lesson sweep execution.

---

## 4. Maintenance & Audits

### Inspecting logs
If you need to audit what tools Andy called, run:
```bash
pnpm run inspect
```
This CLI inspector queries `andy.db` directly in WAL mode and outputs a timeline of the last interactions, including arguments, token counts, and execution status.

### Sandboxing (ProtectSystem)
Andy runs inside a kernel-level Systemd namespace jail:
* **Write Blocks:** Writes outside of the project root, task configuration folders, temporary directories, and `AndyMemory/` are blocked at the OS kernel level.
* **Credential Protection:** Andy has a blanked out `ProtectHome=tmpfs` user namespace, preventing him from seeing host SSH keys, shell history, or system config files.
