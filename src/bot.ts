import { Client, GatewayIntentBits, AttachmentBuilder } from 'discord.js';
import { runAgentTurn } from './agent.ts';

function splitForLimit(text: string, limit: number): string[] {
  if (!text) return [];
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n\n', limit);
    if (cut <= 0) cut = remaining.lastIndexOf('\n', limit);
    if (cut <= 0) cut = remaining.lastIndexOf(' ', limit);
    if (cut <= 0) cut = limit;
    chunks.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}


export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.once('ready', () => {
  console.log(`[Bot] Discord client connected as: ${client.user?.tag}`);
});

client.on('messageCreate', async (message) => {
  console.log(`[Bot Debug] messageCreate event: channelId=${message.channelId}, channelName=${(message.channel as any).name}, author=${message.author.tag}, content="${message.content}"`);
  // 1. Ignore bot messages and system events
  if (message.author.bot) return;

  // Verify Andy is mentioned or it's a DM, or it's one of his dedicated channels
  const botUser = client.user;
  if (!botUser) return;

  const isMentioned = message.mentions.has(botUser);
  const isDM = !message.guild;
  const channelName = (message.channel as any).name || 'main';
  
  // Dedicated channels Andy monitors automatically without pings
  const monitoredChannels = ['main', 'weather', 'news', 'misc', 'typescript', 'devops', 'logs', 'issues'];
  const isMonitoredChannel = monitoredChannels.some(ch => channelName.toLowerCase().includes(ch));

  if (!isMentioned && !isDM && !isMonitoredChannel) {
    return;
  }

  // Scrub the @mention from the prompt text
  let promptText = message.content;
  const botMentionRegex = new RegExp(`<@!?${botUser.id}>`, 'g');
  promptText = promptText.replace(botMentionRegex, '').trim();

  // If message is just a bare mention, ignore
  if (!promptText && isMentioned) {
    message.reply('Yes? How can I help you?');
    return;
  }

  console.log(`[Bot] Received message in channel #${channelName} from ${message.author.username}: "${promptText}"`);

  // 2. Fetch recent channel history for conversation context (up to 5 messages)
  const history: any[] = [];
  try {
    const fetched = await message.channel.messages.fetch({ limit: 6 });
    const sorted = Array.from(fetched.values()).reverse();
    // Exclude the current message (the last one)
    const contextMessages = sorted.slice(0, -1);

    for (const msg of contextMessages) {
      if (msg.author.bot && msg.author.id !== botUser.id) continue; // Ignore other bots
      const role = msg.author.id === botUser.id ? 'model' : 'user';
      
      // Clean mention tags out of history texts
      const text = msg.content.replace(botMentionRegex, '').trim();
      if (text) {
        history.push({
          role,
          parts: [{ text }]
        });
      }
    }
  } catch (histErr) {
    console.error('[Bot] Failed to retrieve context history:', histErr);
  }

  // 3. Keep typing indicator active during long turns
  message.channel.sendTyping();
  const typingInterval = setInterval(() => {
    message.channel.sendTyping().catch(() => {});
  }, 5000);

  // 4. Run the turn through Gemini agent
  try {
    const turnResult = await runAgentTurn(channelName, promptText, history);

    // Stop typing indicator
    clearInterval(typingInterval);

    // 5. Send response back to Discord, chunked appropriately
    const cleanedText = turnResult.text.replace(/\[Attached:\s*[^\]]+\]/gi, '').trim();
    const chunks = splitForLimit(cleanedText, 1990);

    if (chunks.length === 0 && turnResult.imageAttachment) {
      const file = new AttachmentBuilder(turnResult.imageAttachment.buffer, {
        name: turnResult.imageAttachment.name
      });
      const payload = { content: '', files: [file] };
      if (isDM || isMentioned) {
        await message.reply(payload);
      } else {
        await message.channel.send(payload);
      }
    } else {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const payload: any = { content: chunk };
        
        // Attach the image only to the first message chunk
        if (i === 0 && turnResult.imageAttachment) {
          const file = new AttachmentBuilder(turnResult.imageAttachment.buffer, {
            name: turnResult.imageAttachment.name
          });
          payload.files = [file];
        }

        // Use reply for first message if DM/mentioned, send to channel for others
        if (i === 0 && (isDM || isMentioned)) {
          await message.reply(payload);
        } else {
          await message.channel.send(payload);
        }
      }
    }
  } catch (err: any) {
    clearInterval(typingInterval);
    console.error('[Bot] Message turn execution failed:', err);
    await message.reply(`Sorry, I encountered an error executing this request: ${err.message}`);
  }
});
