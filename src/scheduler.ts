import * as fs from 'fs';
import * as path from 'path';
import parser from 'cron-parser';
import { db } from './db.ts';
import { runAgentTurn } from './agent.ts';
import { AttachmentBuilder } from 'discord.js';

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


const TASK_CONFIG_PATH = path.resolve('/home/kyle/.gemini/state/task-config.json');
const PROGRESS_PATH = path.resolve('/home/kyle/.gemini/tmp/kyle/ts-lesson-progress.json');

const CURRICULUM = [
  "Primitive Types & Type Annotations",
  "Interfaces & Type Aliases",
  "Functions & Return Types",
  "Arrays & Tuples",
  "Generics Basics",
  "Enums & Literal Types",
  "Union Types",
  "Intersection Types",
  "Type Guards & Narrowing",
  "Utility Types (Partial, Pick, Omit, Record)",
  "Type Assertions & the 'as' Keyword",
  "Promise Types & Async/Await Typing",
  "Module Systems (ESM vs CJS in Node)",
  "Declaration Files & DefinitelyTyped",
  "Discriminated Unions & Exhaustiveness Checking",
];

// --- Helper: Enforce America/Chicago timezone for Cron calculations ---
function getNextCronDate(cronExpr: string): Date {
  const interval = parser.parseExpression(cronExpr, { tz: 'America/Chicago' });
  return interval.next().toDate();
}

function loadTaskConfig() {
  try {
    if (fs.existsSync(TASK_CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(TASK_CONFIG_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function loadTSProgress() {
  try {
    if (fs.existsSync(PROGRESS_PATH)) {
      return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
    }
  } catch {}
  return { currentLesson: 11, completedAt: [] };
}

function saveTSProgress(progress: any) {
  const dir = path.dirname(PROGRESS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');
}

export function syncDefaultTasks() {
  const defaultJobs = [
    {
      id: 'core_morning_weather',
      kind: 'recurring',
      cron: '0 6 * * *', // 6:00 AM daily
      blueprint: 'blueprints/weather-morning.md',
      channel_id: '1494156244439666829' // #weather
    },
    {
      id: 'core_morning_report',
      kind: 'recurring',
      cron: '0 7 * * 1-5', // 7:00 AM Mon-Fri
      blueprint: 'blueprints/morning-report.md',
      channel_id: '1505347468785619014' // #main
    },
    {
      id: 'core_typescript_lesson',
      kind: 'recurring',
      cron: '0 7 * * 1-5', // 7:00 AM Mon-Fri
      blueprint: 'blueprints/ts-lesson.md',
      channel_id: '1494156616071643386' // #typescript-learning
    },
    {
      id: 'core_typescript_recap',
      kind: 'recurring',
      cron: '0 7 * * 6', // 7:00 AM Saturday
      blueprint: 'blueprints/ts-recap.md',
      channel_id: '1494156616071643386' // #typescript-learning
    },
    {
      id: 'core_evening_weather',
      kind: 'recurring',
      cron: '0 20 * * *', // 8:00 PM daily
      blueprint: 'blueprints/weather-evening.md',
      channel_id: '1494156244439666829' // #weather
    }
  ];

  for (const job of defaultJobs) {
    const existing = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id) as any;
    if (!existing) {
      const nextDate = getNextCronDate(job.cron).toISOString();
      db.prepare(`
        INSERT INTO jobs (id, kind, status, cron, blueprint, channel_id, process_after)
        VALUES (?, ?, 'pending', ?, ?, ?, ?)
      `).run(job.id, job.kind, job.cron, job.blueprint, job.channel_id, nextDate);
      console.log(`[Scheduler] Initialized default task: ${job.id}`);
    } else {
      // Sync parameters if changed, but preserve next run date
      db.prepare(`
        UPDATE jobs SET cron = ?, blueprint = ?, channel_id = ?
        WHERE id = ?
      `).run(job.cron, job.blueprint, job.channel_id, job.id);
    }
  }
}

export function startScheduler(discordClient: any) {
  console.log('[Scheduler] Starting 30s sweep engine...');
  
  // Run sweep immediately at boot, then schedule recurring sweep
  runSweep(discordClient).catch(console.error);
  setInterval(() => {
    runSweep(discordClient).catch(console.error);
  }, 30000);
}

const activeJobs = new Set<string>();

async function runSweep(discordClient: any) {
  const nowStr = new Date().toISOString();
  
  // Find all due jobs
  const dueJobs = db.prepare(`
    SELECT * FROM jobs 
    WHERE status = 'pending' AND (process_after IS NULL OR process_after <= ?)
  `).all(nowStr) as any[];

  for (const job of dueJobs) {
    if (activeJobs.has(job.id)) {
      console.log(`[Scheduler] Skipping job ${job.id}: already executing`);
      continue;
    }

    activeJobs.add(job.id);

    try {
      console.log(`[Scheduler] Running due job: ${job.id}`);
      
      // 1. Evaluate pause/skip checks from task-config
      const config = loadTaskConfig();
      const taskKey = job.id === 'core_typescript_lesson' ? 'typescript_lesson' : job.id.replace('core_', '');
      const taskConfig = config[taskKey];

      if (taskConfig?.paused) {
        console.log(`[Scheduler] Skipping job ${job.id}: paused in config`);
        rescheduleJob(job);
        continue;
      }

      if (taskConfig?.paused_until) {
        const todayDate = new Date().toISOString().split('T')[0];
        if (todayDate < taskConfig.paused_until) {
          console.log(`[Scheduler] Skipping job ${job.id}: paused until ${taskConfig.paused_until}`);
          rescheduleJob(job);
          continue;
        } else {
          // Auto-resume: clear paused_until parameter
          db.prepare('UPDATE jobs SET last_error = NULL WHERE id = ?').run(job.id);
        }
      }

      // 2. Read and parse blueprint
      const bpPath = path.resolve(import.meta.dirname, '../', job.blueprint);
      if (!fs.existsSync(bpPath)) {
        console.error(`[Scheduler] Blueprint not found for job ${job.id}: ${job.blueprint}`);
        db.prepare('UPDATE jobs SET status = \'errored\', last_error = ? WHERE id = ?')
          .run(`Blueprint not found: ${job.blueprint}`, job.id);
        continue;
      }

      let blueprintContent = fs.readFileSync(bpPath, 'utf8');
      
      // 3. Resolve TypeScript lesson parameters if applicable
      if (job.id === 'core_typescript_lesson') {
        const progress = loadTSProgress();
        const lessonNumber = progress.currentLesson;

        if (lessonNumber > CURRICULUM.length) {
          console.log('[Scheduler] TS Curriculum complete. Skipping delivery.');
          rescheduleJob(job);
          continue;
        }

        const topic = CURRICULUM[lessonNumber - 1];
        blueprintContent = blueprintContent
          .replace('{{lessonNumber}}', String(lessonNumber))
          .replace('{{topic}}', topic);
      }

      if (job.id === 'core_typescript_recap') {
        const progress = loadTSProgress();
        const currentLesson = progress.currentLesson;
        const startLesson = Math.max(1, currentLesson - 5);
        const endLesson = currentLesson - 1;

        if (endLesson < startLesson) {
          console.log('[Scheduler] No lessons completed yet. Skipping Saturday recap.');
          rescheduleJob(job);
          continue;
        }

        const topicsList: string[] = [];
        for (let i = startLesson; i <= endLesson; i++) {
          topicsList.push(`- Lesson ${i}: ${CURRICULUM[i - 1]}`);
        }

        blueprintContent = blueprintContent
          .replace('{{topicsList}}', topicsList.join('\n'));
      }

      // 4. Run the turn through our agent
      try {
        const turnResult = await runAgentTurn('weather', blueprintContent); // Runs in background
        
        // Resolve formatting for TS daily lesson JSON blocks
        let messagesToSend: string[] = [];

        if (job.id === 'core_typescript_lesson' || job.id === 'core_typescript_recap') {
          try {
            let cleanJson = turnResult.text.trim();
            if (cleanJson.startsWith('```json')) {
              cleanJson = cleanJson.substring(7);
            } else if (cleanJson.startsWith('```')) {
              cleanJson = cleanJson.substring(3);
            }
            if (cleanJson.endsWith('```')) {
              cleanJson = cleanJson.substring(0, cleanJson.length - 3);
            }
            cleanJson = cleanJson.trim();

            const parsed = JSON.parse(cleanJson);
            if (parsed.prose) messagesToSend.push(parsed.prose);
            if (parsed.code) messagesToSend.push(parsed.code);
            if (parsed.followup) messagesToSend.push(parsed.followup);
          } catch (parseErr) {
            console.warn(`[Scheduler] Failed to parse ${job.id} JSON, falling back to raw text:`, parseErr);
          }
        }

        if (messagesToSend.length === 0) {
          messagesToSend = [turnResult.text];
        }

        // Post result to Discord
        const channel = await discordClient.channels.fetch(job.channel_id);
        if (channel && channel.isTextBased()) {
          let sentImage = false;

          for (let i = 0; i < messagesToSend.length; i++) {
            const msgContent = messagesToSend[i];
            const cleanedContent = msgContent.replace(/\[Attached:\s*[^\]]+\]/gi, '').trim();
            const chunks = splitForLimit(cleanedContent, 1990);
            
            if (chunks.length === 0) {
              // If cleaned content is empty but we have an image to attach, send it
              if (i === 0 && turnResult.imageAttachment && !sentImage) {
                const file = new AttachmentBuilder(turnResult.imageAttachment.buffer, {
                  name: turnResult.imageAttachment.name
                });
                await channel.send({ content: '', files: [file] });
                sentImage = true;
              }
              continue;
            }

            for (let j = 0; j < chunks.length; j++) {
              const chunk = chunks[j];
              const payload: any = { content: chunk };
              
              // Attach the image only to the very first chunk of the first message
              if (i === 0 && j === 0 && turnResult.imageAttachment && !sentImage) {
                const file = new AttachmentBuilder(turnResult.imageAttachment.buffer, {
                  name: turnResult.imageAttachment.name
                });
                payload.files = [file];
                sentImage = true;
              }
              
              await channel.send(payload);
            }
          }
          console.log(`[Scheduler] Successfully posted task output for ${job.id}`);
        }

        // If TS lesson succeeded, advance lesson progress
        if (job.id === 'core_typescript_lesson') {
          const progress = loadTSProgress();
          progress.completedAt.push(new Date().toISOString().split('T')[0]);
          progress.currentLesson += 1;
          saveTSProgress(progress);
        }

        // 5. Update SQLite job status (Reschedule/Rollover)
        rescheduleJob(job);
      } catch (err: any) {
        console.error(`[Scheduler] Error running job ${job.id}:`, err);
        db.prepare(`
          UPDATE jobs 
          SET tries = tries + 1, last_error = ?, status = CASE WHEN tries >= 3 THEN 'errored' ELSE 'pending' END, process_after = ?
          WHERE id = ?
        `).run(err.message, new Date(Date.now() + 300000).toISOString(), job.id); // Retry in 5 minutes

        try {
          const errChannel = await discordClient.channels.fetch(job.channel_id);
          if (errChannel && errChannel.isTextBased()) {
            await errChannel.send(`⚠️ **[Scheduled Task Alert]** Failed to execute task \`${job.id}\`: ${err.message}`);
          }

          // Post to #logs-and-issues channel
          let logsChannel: any = null;
          logsChannel = discordClient.channels.cache.find(
            (c: any) => c.name === 'logs-and-issues' || c.name === 'logs' || c.name === 'issues'
          );
          if (!logsChannel) {
            for (const guild of discordClient.guilds.cache.values()) {
              const channels = await guild.channels.fetch();
              const found = channels.find((c: any) => c.name === 'logs-and-issues' || c.name === 'logs' || c.name === 'issues');
              if (found) {
                logsChannel = found;
                break;
              }
            }
          }

          if (logsChannel && logsChannel.isTextBased() && logsChannel.id !== job.channel_id) {
            await logsChannel.send(`⚠️ **[Scheduler Error]** Task \`${job.id}\` failed in <#${job.channel_id}>: ${err.message}`);
          }
        } catch (postErr: any) {
          console.error('[Scheduler] Failed to send error notification to Discord:', postErr.message);
        }
      }
    } finally {
      activeJobs.delete(job.id);
    }
  }
}

function rescheduleJob(job: any) {
  if (job.kind === 'oneshot') {
    db.prepare('UPDATE jobs SET status = \'completed\' WHERE id = ?').run(job.id);
  } else {
    const nextDate = getNextCronDate(job.cron).toISOString();
    db.prepare(`
      UPDATE jobs 
      SET process_after = ?, tries = 0, last_error = NULL, status = 'pending'
      WHERE id = ?
    `).run(nextDate, job.id);
    console.log(`[Scheduler] Rescheduled job ${job.id} for next run: ${nextDate}`);
  }
}
