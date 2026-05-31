import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const DB_DIR = path.resolve(import.meta.dirname, '../data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'andy.db');
export const db = new Database(DB_PATH);

// Configure WAL mode for concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

export function initDatabase() {
  // 1. Create jobs table for the scheduler
  db.prepare(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('recurring', 'oneshot')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'paused', 'completed', 'errored')),
      cron TEXT,
      blueprint TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      process_after TEXT,
      params TEXT,
      last_error TEXT,
      tries INTEGER NOT NULL DEFAULT 0
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_jobs_due ON jobs(status, process_after);
  `).run();

  // 2. Create interaction_log table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS interaction_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      channel TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      tokens_used INTEGER
    )
  `).run();

  // 3. Create tool_call_log table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS tool_call_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interaction_log_id INTEGER,
      ts TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      args TEXT NOT NULL,
      result TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('success', 'error')),
      FOREIGN KEY(interaction_log_id) REFERENCES interaction_log(id) ON DELETE CASCADE
    )
  `).run();
}
