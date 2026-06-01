import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getPermissions } from './config.ts';

const execAsync = promisify(exec);

const MEMORY_DIR = path.resolve('/home/kyle/Documents/obsidian/QwertyMemory');
const TASK_CONFIG_PATH = path.resolve('/home/kyle/.gemini/state/task-config.json');

// --- Helper: Refresh Google API Token ---
interface GoogleTokenData {
  access_token: string;
  refresh_token: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

interface GCPKeys {
  installed: {
    client_id: string;
    client_secret: string;
    token_uri: string;
  };
}

async function getGoogleAccessToken(service: 'calendar' | 'gmail' | 'drive'): Promise<string> {
  const mcpDir = service === 'calendar' ? 'google-calendar-mcp' : service === 'gmail' ? 'gmail-mcp' : 'google-drive-mcp';
  const tokenFile = service === 'gmail' ? 'credentials.json' : 'tokens.json';

  const keysPath = path.join('/home/kyle/.config', mcpDir, 'gcp-oauth.keys.json');
  const tokenPath = path.join('/home/kyle/.config', mcpDir, tokenFile);

  if (!fs.existsSync(keysPath) || !fs.existsSync(tokenPath)) {
    throw new Error(`Google credentials not configured for ${service}`);
  }

  const keys: GCPKeys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
  const tokens: any = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

  // Some token formats are nested, some are flat
  const tokenData: GoogleTokenData = tokens.normal ? tokens.normal : tokens;

  // Refresh token request
  const res = await fetch(keys.installed.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: keys.installed.client_id,
      client_secret: keys.installed.client_secret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token'
    })
  });

  if (!res.ok) {
    throw new Error(`Failed to refresh Google token for ${service}: ${await res.text()}`);
  }

  const data: any = await res.json();
  return data.access_token;
}

// --- Declarations of Tools for Gemini ---
export const toolDeclarations = [
  {
    name: 'execute_command',
    description: 'Execute a bash command on the local Pi5. Blocked from systemctl or destructive utilities.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: { type: 'STRING', description: 'The exact shell command to run.' }
      },
      required: ['command']
    }
  },
  {
    name: 'recall_memory',
    description: 'Search Obsidian long-term wiki notes, compiled knowledge indices, and past Discord conversation logs for a specific topic, keyword, or query.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Search term, keyword, or kebab-case memory slug.' }
      },
      required: ['query']
    }
  },
  {
    name: 'save_memory',
    description: 'Persist a fact to Obsidian long-term memory. Use a short kebab-case topic slug (e.g. favorite-color) to overwrite in place.',
    parameters: {
      type: 'OBJECT',
      properties: {
        topic: { type: 'STRING', description: 'Kebab-case slug. Reuse to overwrite previous details.' },
        fact: { type: 'STRING', description: 'The fact to remember (max 500 characters).' }
      },
      required: ['topic', 'fact']
    }
  },
  {
    name: 'google_calendar_list_events',
    description: 'List events on a calendar for a specified date range.',
    parameters: {
      type: 'OBJECT',
      properties: {
        calendarId: { type: 'STRING', description: 'Calendar ID, usually "primary" or email address.' },
        timeMin: { type: 'STRING', description: 'ISO start date-time (e.g. 2026-05-31T00:00:00Z).' },
        timeMax: { type: 'STRING', description: 'ISO end date-time (e.g. 2026-05-31T23:59:59Z).' }
      },
      required: ['calendarId', 'timeMin', 'timeMax']
    }
  },
  {
    name: 'google_gmail_list_messages',
    description: 'List Gmail message metadata matching a query.',
    parameters: {
      type: 'OBJECT',
      properties: {
        q: { type: 'STRING', description: 'Gmail query string (e.g. "is:unread").' },
        maxResults: { type: 'INTEGER', description: 'Max results to return (default 5).' }
      },
      required: ['q']
    }
  },
  {
    name: 'google_gmail_get_message',
    description: 'Fetch the headers and snippet of a specific Gmail message by ID.',
    parameters: {
      type: 'OBJECT',
      properties: {
        id: { type: 'STRING', description: 'The unique message ID.' }
      },
      required: ['id']
    }
  },
  {
    name: 'google_drive_list_files',
    description: 'Search or list files in Google Drive.',
    parameters: {
      type: 'OBJECT',
      properties: {
        q: { type: 'STRING', description: 'Drive query query string.' },
        maxResults: { type: 'INTEGER', description: 'Max results to return (default 5).' }
      },
      required: ['q']
    }
  },
  {
    name: 'generate_image',
    description: 'Generate an image using Nanobanana (Imagen 4.0). Returns the prompt confirmation; image is sent directly.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING', description: 'Text description of the image to generate.' }
      },
      required: ['prompt']
    }
  },
  {
    name: 'take_screenshot',
    description: 'Take a screenshot of a webpage and send it back to the channel.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: { type: 'STRING', description: 'The absolute URL of the webpage to capture (must start with http:// or https://).' }
      },
      required: ['url']
    }
  },
  {
    name: 'web_search',
    description: 'Search the web using Google Search to get current info or find webpage URLs.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'The search query.' }
      },
      required: ['query']
    }
  },
  {
    name: 'update_task_config',
    description: 'Dynamically update parameters for scheduled tasks (weather lat/lon/location or typescript_lesson pause).',
    parameters: {
      type: 'OBJECT',
      properties: {
        task_name: { type: 'STRING', description: 'Name of the task ("weather" or "typescript_lesson").' },
        config: {
          type: 'OBJECT',
          properties: {
            paused: { type: 'BOOLEAN' },
            paused_until: { type: 'STRING', description: 'ISO date string YYYY-MM-DD to resume.' },
            location: { type: 'STRING' }
          }
        }
      },
      required: ['task_name', 'config']
    }
  },
  {
    name: 'send_local_attachment',
    description: 'Send/upload an existing file from the local attachments directory back to the Discord channel.',
    parameters: {
      type: 'OBJECT',
      properties: {
        filename: { type: 'STRING', description: 'The name of the file (e.g., "image.png" or "data.csv") within the attachments folder.' }
      },
      required: ['filename']
    }
  },
  {
    name: 'send_channel_message',
    description: 'Send a text message to a specific Discord channel in the guild (e.g. logs-and-issues, main, weather).',
    parameters: {
      type: 'OBJECT',
      properties: {
        channelName: { type: 'STRING', description: 'The name of the channel (without leading #), e.g. "logs-and-issues".' },
        messageText: { type: 'STRING', description: 'The text message content to send.' }
      },
      required: ['channelName', 'messageText']
    }
  }
];

// --- Implementation Handlers ---
export const toolHandlers: { [toolName: string]: (args: any, context?: any) => Promise<any> } = {
  execute_command: async ({ command }) => {
    const perms = getPermissions();

    // 1. Verify against explicit deny/allow keywords
    const cleanCommand = command.trim();
    const commandWords = cleanCommand.split(/\s+/);
    const commandBase = commandWords[0]?.toLowerCase();

    // Deny check using regex word boundaries to avoid false positives (e.g. format=j1)
    const isDenied = perms.bash.deny.some(deny => {
      const regex = new RegExp('\\b' + deny + '\\b', 'i');
      return regex.test(cleanCommand);
    });

    // Allow check (must start with or match allowed prefix)
    const isAllowed = perms.bash.allow.some(allow => 
      commandBase === allow || cleanCommand.startsWith(allow)
    );

    if (isDenied || !isAllowed) {
      return `Error: Command execution blocked by security policy (command is not in the allowlist or matched denylist).`;
    }

    // 2. Perform execution
    try {
      console.log(`[Tool] Executing command: ${command}`);
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      return { stdout, stderr };
    } catch (error: any) {
      return { error: error.message, stdout: error.stdout, stderr: error.stderr };
    }
  },

  recall_memory: async ({ query }) => {
    try {
      const searchDirs = [
        '/home/kyle/Documents/obsidian/QwertyMemory',
        '/home/kyle/Documents/obsidian/dev',
        '/home/kyle/Documents/obsidian/dev/AI-Knowledge-Base',
        '/home/kyle/Documents/obsidian/dev/AI-Knowledge-Base/concepts',
        '/home/kyle/Documents/obsidian/dev/AI-Knowledge-Base/connections'
      ];
      
      const queryLower = query.toLowerCase();
      
      // Normalize query to search terms (remove possessives and split)
      const searchTerms = queryLower
        .replace(/['’]s/g, '')
        .split(/[^a-z0-9]+/g)
        .filter(term => term.length >= 2);

      if (searchTerms.length === 0) {
        searchTerms.push(queryLower);
      }

      const results: string[] = [];

      // --- Part A: Search Obsidian Markdown Files ---
      const fileMatches: { file: string; content: string }[] = [];
      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
        for (const file of files) {
          const filePath = path.join(dir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const contentLower = content.toLowerCase();
          const fileLower = file.toLowerCase();

          // Match if every search term is found as a whole word to prevent false positives (e.g. "race" matching "graceful")
          const isMatch = searchTerms.every(term => {
            const regex = new RegExp('\\b' + term + '\\b', 'i');
            return regex.test(fileLower) || regex.test(contentLower);
          });

          if (isMatch) {
            // Strip frontmatter metadata tags for cleaner context ingestion
            const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');
            fileMatches.push({ file: path.basename(file), content: body });
          }
        }
      }

      if (fileMatches.length > 0) {
        const slicedFiles = fileMatches.slice(0, 3);
        const fileContent = slicedFiles.map(r => `[Obsidian Note: ${r.file}]\n${r.content.trim()}`).join('\n\n');
        results.push(`=== Obsidian Notes ===\n${fileContent}`);
      }

      // --- Part B: Search SQLite Conversation Logs ---
      try {
        const { db } = await import('./db.ts');
        
        // Fetch recent logs to filter using strict word boundaries in JS
        const rows = db.prepare(`
          SELECT ts, channel, prompt, response FROM interaction_log
          ORDER BY ts DESC
          LIMIT 300
        `).all() as any[];

        const dbMatches: any[] = [];
        for (const row of rows) {
          const promptLower = (row.prompt || '').toLowerCase();
          const responseLower = (row.response || '').toLowerCase();

          const isMatch = searchTerms.every(term => {
            const regex = new RegExp('\\b' + term + '\\b', 'i');
            return regex.test(promptLower) || regex.test(responseLower);
          });

          if (isMatch) {
            dbMatches.push(row);
          }
        }

        if (dbMatches.length > 0) {
          const slicedDb = dbMatches.slice(0, 10); // Return up to 10 matching conversation items
          const dbContent = slicedDb.map(m => 
            `[${m.ts}] [Channel: #${m.channel}]\nUser: "${m.prompt}"\nQwerty: "${m.response}"`
          ).join('\n---\n');
          results.push(`=== Past Conversation Logs ===\n${dbContent}`);
        }
      } catch (dbErr: any) {
        console.error('[recall_memory] Failed to search DB logs:', dbErr);
      }

      if (results.length === 0) {
        return `No notes or conversation logs matched query: "${query}" (Terms: ${searchTerms.join(', ')})`;
      }

      return results.join('\n\n');
    } catch (error: any) {
      return `Error recalling memory: ${error.message}`;
    }
  },

  save_memory: async ({ topic, fact }) => {
    try {
      if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
      }

      const slug = topic.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      const filePath = path.join(MEMORY_DIR, `${slug}.md`);

      const frontmatter = `---
title: ${slug}
updated: ${new Date().toISOString()}
---
${fact}
`;

      fs.writeFileSync(filePath, frontmatter, 'utf8');
      console.log(`[Tool] Saved memory topic: ${slug}`);
      return `Fact successfully saved to memory shard: ${slug}.md`;
    } catch (error: any) {
      return `Error saving memory: ${error.message}`;
    }
  },

  google_calendar_list_events: async ({ calendarId, timeMin, timeMax }) => {
    try {
      const token = await getGoogleAccessToken('calendar');
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Google Calendar API error: ${await res.text()}`);

      const data: any = await res.json();
      return (data.items || []).map((e: any) => ({
        summary: e.summary,
        location: e.location,
        description: e.description,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date
      }));
    } catch (error: any) {
      return `Error fetching calendar events: ${error.message}`;
    }
  },

  google_gmail_list_messages: async ({ q, maxResults = 5 }) => {
    try {
      const token = await getGoogleAccessToken('gmail');
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${maxResults}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Gmail API error: ${await res.text()}`);

      const data: any = await res.json();
      return data.messages || [];
    } catch (error: any) {
      return `Error fetching Gmail list: ${error.message}`;
    }
  },

  google_gmail_get_message: async ({ id }) => {
    try {
      const token = await getGoogleAccessToken('gmail');
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Gmail get API error: ${await res.text()}`);

      const data: any = await res.json();
      const headers = data.payload?.headers || [];
      const subject = headers.find((h: any) => h.name?.toLowerCase() === 'subject')?.value || '(No Subject)';
      const from = headers.find((h: any) => h.name?.toLowerCase() === 'from')?.value || '(Unknown)';

      return {
        id: data.id,
        snippet: data.snippet,
        subject,
        from,
        internalDate: data.internalDate
      };
    } catch (error: any) {
      return `Error fetching Gmail message: ${error.message}`;
    }
  },

  google_drive_list_files: async ({ q, maxResults = 5 }) => {
    try {
      const token = await getGoogleAccessToken('drive');
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&pageSize=${maxResults}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) throw new Error(`Google Drive API error: ${await res.text()}`);

      const data: any = await res.json();
      return (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType
      }));
    } catch (error: any) {
      return `Error listing Google Drive files: ${error.message}`;
    }
  },

  generate_image: async ({ prompt }, context) => {
    try {
      console.log(`[Tool] Generating image: "${prompt}"`);
      const client = context?.geminiClient;
      if (!client) throw new Error('Gemini API client not initialized in execution context');

      const response = await client.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt: prompt,
      });

      if (response.generatedImages?.[0]?.image?.imageBytes) {
        const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64');
        context.imageAttachment = {
          buffer,
          name: 'nanobanana.png',
          prompt
        };
        return `Image successfully generated for prompt: "${prompt}". It will be sent shortly.`;
      } else {
        throw new Error('No image bytes returned in API response.');
      }
    } catch (error: any) {
      return `Error generating image: ${error.message}`;
    }
  },

  take_screenshot: async ({ url }, context) => {
    try {
      console.log(`[Tool] Taking screenshot of: "${url}"`);
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new Error('URL must start with http:// or https://');
      }

      const apiUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&embed=screenshot.url`;
      const res = await fetch(apiUrl);
      if (!res.ok) {
        throw new Error(`Screenshot API returned error: ${res.statusText} (${res.status})`);
      }

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length < 1000) {
        throw new Error('Retrieved screenshot image is empty or invalid.');
      }

      context.imageAttachment = {
        buffer,
        name: 'screenshot.png',
        prompt: `Screenshot of ${url}`
      };

      return `Screenshot of "${url}" successfully captured and attached to message.`;
    } catch (error: any) {
      return `Error capturing screenshot: ${error.message}`;
    }
  },

  web_search: async ({ query }, context) => {
    try {
      console.log(`[Tool] Web searching for: "${query}"`);
      const client = context?.geminiClient;
      if (!client) throw new Error('Gemini API client not initialized in execution context');

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: query }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      return response.text || 'No search results returned.';
    } catch (error: any) {
      return `Error performing web search: ${error.message}`;
    }
  },

  update_task_config: async ({ task_name, config }) => {
    try {
      let state: any = {};
      if (fs.existsSync(TASK_CONFIG_PATH)) {
        state = JSON.parse(fs.readFileSync(TASK_CONFIG_PATH, 'utf8'));
      }

      state[task_name] = {
        ...(state[task_name] || {}),
        ...config
      };

      const dir = path.dirname(TASK_CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      // Atomic write (temp file + rename)
      const tmpPath = `${TASK_CONFIG_PATH}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
      fs.renameSync(tmpPath, TASK_CONFIG_PATH);

      console.log(`[Tool] Updated config for task ${task_name}:`, JSON.stringify(config));
      return `Task configuration for "${task_name}" updated successfully.`;
    } catch (error: any) {
      return `Error updating task config: ${error.message}`;
    }
  },

  send_local_attachment: async ({ filename }, context) => {
    try {
      if (!context) {
        throw new Error('Execution context is not initialized.');
      }

      const attachmentsDir = path.resolve(process.cwd(), 'attachments');

      // Restrict strictly to filename to prevent directory traversal
      const safeFilename = path.basename(filename);
      const filePath = path.resolve(attachmentsDir, safeFilename);

      if (!filePath.startsWith(attachmentsDir)) {
        throw new Error('Access denied: File path escapes the attachments directory.');
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: "${safeFilename}" does not exist in the attachments directory.`);
      }

      const buffer = fs.readFileSync(filePath);

      context.imageAttachment = {
        buffer,
        name: safeFilename,
        prompt: `Uploaded attachment: ${safeFilename}`
      };

      console.log(`[Tool] Attached file from attachments folder: ${safeFilename}`);
      return `File "${safeFilename}" was successfully read and attached to the response.`;
    } catch (error: any) {
      return `Error sending local attachment: ${error.message}`;
    }
  },

  send_channel_message: async ({ channelName, messageText }) => {
    try {
      const { client } = await import('./bot.ts');
      const channel = client.channels.cache.find((c: any) => c.name === channelName);
      if (!channel) {
        return `Error: Channel "${channelName}" not found in cache.`;
      }
      await channel.send(messageText);
      return `Message successfully sent to channel #${channelName}.`;
    } catch (error: any) {
      return `Error sending message: ${error.message}`;
    }
  }
};
