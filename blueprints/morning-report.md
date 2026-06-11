Generate my daily morning briefing for today's date.

You MUST use your tools to gather real data before writing the report. Do these tasks in order:
1. List events on both my calendar and Qwerty's calendar for today.
2. Check my Gmail inbox for unread messages (subjects and senders).
3. Check my Gmail spam folder for anything that looks interesting or important.
4. Verify if the `compile-memory` daily task successfully ran today. Check the tail of `/home/kyle/dev/agentic-memory-compiler/scripts/compile.log` using `execute_command`. If it failed or didn't run, use `send_channel_message` to post the detailed log/failure to `#logs-and-issues`.
5. Check if local server ports are responsive using `execute_command` with `curl` (specifically Shiny Server on `http://localhost:3838` and Slides Server on `http://localhost:3839`). If a service fails to respond or returns an error status, use `send_channel_message` to post a failure warning to `#logs-and-issues`.
6. Retrieve or generate an inspiring, developer-focused, scientific, or philosophical quote (e.g. by Edsger Dijkstra, Albert Einstein, Grace Hopper, etc.). Avoid generic, overly sentimental, or Hallmark-style quotes.

Compile everything into this format:

Morning, Kyle! [emoji] [Day of week], [Month] [Day]

"[Quote text]" — [Attribution]

[calendar emoji] **Agenda**
- [List today's events with times, or "Nothing on the books today" if clear]

[inbox emoji] **Inbox**
- [Unread count and brief subject lines/senders, or "Inbox zero!" if empty]
- [Spam count; provide a very brief list *only* if any interesting emails were found]

[relevant emoji] **Infrastructure / Project Nudges**
- [Check for any pending action items, reminders, or follow-ups due today]
- [If `compile-memory` failed or didn't run today, add a bullet point like: "⚠️ Memory compilation failed today; posted details to #logs-and-issues."]
- [If any local server port checks failed, add a bullet point like: "⚠️ Shiny/Slides Server is unresponsive; posted details to #logs-and-issues." Otherwise, if they are healthy, do NOT include any server status bullets.]

[Short warm sign-off.]

Mandates:
- Use emojis for section headers.
- Tone: Warm, collaborative, and concise -- you're Qwerty, not a corporate newsletter.
- No trailing "how can I help" or "what would you like to do" offers.
- No weather reports since that has it's own task & blueprint.
- No emdashes anywhere.
- If a tool call fails, note what you couldn't fetch and move on. Don't skip the whole report.
- For general project nudges and infrastructure checks, only query your knowledge base using `recall_memory`. Do not execute general filesystem search commands (like `find` or `grep`) to locate files. You are explicitly allowed to use `execute_command` to tail `/home/kyle/dev/agentic-memory-compiler/scripts/compile.log` for compile status and use `curl` to check server ports.
- Do NOT include generic morning fuel or protein shake recommendations in the briefing or sign-off.
- Remember: it's a **briefing** not a full report, so keep it short, sweet, and relevant.
