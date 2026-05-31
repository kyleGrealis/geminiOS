import { GoogleGenAI } from '@google/genai';
import { getPermissions, getSystemInstructions } from './config.ts';
import { toolDeclarations, toolHandlers } from './tools.ts';
import { db } from './db.ts';

let ai: GoogleGenAI | null = null;

export function getGenAIClient(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export interface AgentContext {
  geminiClient: GoogleGenAI;
  imageAttachment?: {
    buffer: Buffer;
    name: string;
    prompt: string;
  };
}

export async function runAgentTurn(
  channelName: string,
  promptText: string,
  history: any[] = []
): Promise<{ text: string; imageAttachment?: AgentContext['imageAttachment'] }> {
  const client = getGenAIClient();
  const perms = getPermissions();

  // 1. Resolve model & thinking configurations for the channel
  const chanConfig = perms.channels?.[channelName] || perms.default;
  const model = chanConfig.model;
  
  // Prepare tools list (filter out denied tools)
  const allowedTools = toolDeclarations.filter(t => {
    if (perms.tools.allow.length > 0 && !perms.tools.allow.includes(t.name)) return false;
    if (perms.tools.deny.includes(t.name)) return false;
    return true;
  });

  const formattedTools = allowedTools.length > 0 ? [{ functionDeclarations: allowedTools }] : [];
  const systemInstruction = getSystemInstructions();

  // Configure GenAI call parameters
  const config: any = {
    systemInstruction,
  };
  if (formattedTools.length > 0) {
    config.tools = formattedTools;
  }
  
  // Set up reasoning model properties (thinking config)
  if (chanConfig.thinking_level === 1 && model.includes('pro')) {
    config.thinkingConfig = {
      thinkingBudget: 2048
    };
  }

  // 2. Build the messages history for Gemini
  // Gemini GenAI API expects parts structure
  const contents: any[] = [];
  for (const turn of history) {
    contents.push(turn);
  }
  contents.push({ role: 'user', parts: [{ text: promptText }] });

  const context: AgentContext = { geminiClient: client };
  let responseText = '';
  let tokensUsed = 0;
  const loggedToolCalls: { name: string; args: string; result: string; status: 'success' | 'error' }[] = [];

  try {
    console.log(`[Agent] Calling Gemini model: ${model} (Thinking: ${chanConfig.thinking_level})`);
    let response = await client.models.generateContent({
      model,
      contents,
      config
    });

    tokensUsed += response.usageMetadata?.totalTokenCount || 0;

    // 3. Execution loop for handling tool calls
    let functionCalls = response.functionCalls;
    let turnCount = 0;
    const maxTurns = 8; // Safety ceiling to prevent loop spirals

    while (functionCalls && functionCalls.length > 0 && turnCount < maxTurns) {
      turnCount++;
      const toolResponses: any[] = [];

      for (const call of functionCalls) {
        console.log(`[Agent] Model requested tool call: ${call.name}`);
        const handler = toolHandlers[call.name];
        let result: any;
        let status: 'success' | 'error' = 'success';

        if (handler) {
          try {
            result = await handler(call.args, context);
            if (result && typeof result === 'object' && result.error) {
              status = 'error';
            }
          } catch (err: any) {
            result = { error: err.message };
            status = 'error';
          }
        } else {
          result = { error: `Tool "${call.name}" is not implemented.` };
          status = 'error';
        }

        // Record for audit log
        loggedToolCalls.push({
          name: call.name,
          args: JSON.stringify(call.args),
          result: typeof result === 'string' ? result : JSON.stringify(result),
          status
        });

        toolResponses.push({
          name: call.name,
          response: { result }
        });
      }

      // Feed functionCall structure and responses back to the model history
      contents.push(response.candidates?.[0]?.content);
      contents.push({
        role: 'tool',
        parts: toolResponses.map(r => ({ functionResponse: r }))
      });

      // Call model again with updated conversational history
      response = await client.models.generateContent({
        model,
        contents,
        config
      });

      tokensUsed += response.usageMetadata?.totalTokenCount || 0;
      functionCalls = response.functionCalls;
    }

    responseText = response.text || '';
  } catch (error: any) {
    console.error('[Agent] GenerateContent Turn Error:', error);
    responseText = `Oops, I ran into an error while processing that turn: ${error.message}`;
  }

  // 4. Log to interaction & tool log database in WAL SQLite
  try {
    const timestamp = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO interaction_log (ts, channel, prompt, response, tokens_used)
      VALUES (?, ?, ?, ?, ?)
    `).run(timestamp, channelName, promptText, responseText, tokensUsed);
    
    const logId = result.lastInsertRowid;

    for (const tool of loggedToolCalls) {
      db.prepare(`
        INSERT INTO tool_call_log (interaction_log_id, ts, tool_name, args, result, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(logId, timestamp, tool.name, tool.args, tool.result, tool.status);
    }
  } catch (logErr) {
    console.error('[Agent] Failed to log interaction details to database:', logErr);
  }

  return {
    text: responseText,
    imageAttachment: context.imageAttachment
  };
}
