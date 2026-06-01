import { initDatabase } from './db.ts';
import { client } from './bot.ts';
import { syncDefaultTasks, startScheduler } from './scheduler.ts';

async function main() {
  console.log('--------------------------------------------');
  console.log('Qwerty (geminiOS) starting up...');
  console.log('--------------------------------------------');

  // 1. Initialize SQLite Database
  try {
    initDatabase();
    console.log('[Init] Database initialization complete.');
  } catch (err) {
    console.error('[Fatal] Database initialization failed:', err);
    process.exit(1);
  }

  // 2. Synchronize default scheduled tasks
  try {
    syncDefaultTasks();
    console.log('[Init] Default task sync complete.');
  } catch (err) {
    console.error('[Fatal] Tasks synchronization failed:', err);
    process.exit(1);
  }

  // 3. Connect to Discord Gateway
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error('[Fatal] DISCORD_BOT_TOKEN is missing in environment (.env).');
    process.exit(1);
  }

  try {
    console.log('[Init] Connecting to Discord...');
    await client.login(token);
  } catch (err) {
    console.error('[Fatal] Discord login failed:', err);
    process.exit(1);
  }

  // 4. Start Scheduler sweep loop
  try {
    startScheduler(client);
    console.log('[Init] Scheduler loop started.');
  } catch (err) {
    console.error('[Fatal] Scheduler startup failed:', err);
    process.exit(1);
  }

  console.log('--------------------------------------------');
  console.log('Qwerty is online and ready!');
  console.log('--------------------------------------------');
}

main().catch((err) => {
  console.error('[Fatal] Boot Exception:', err);
  process.exit(1);
});
