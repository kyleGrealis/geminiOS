import Database from 'better-sqlite3';
import * as path from 'path';

const DB_PATH = path.resolve(import.meta.dirname, '../data/andy.db');

function inspect(lastCount = 5) {
  const db = new Database(DB_PATH, { readonly: true });

  console.log('================================================================');
  console.log(`           geminiOS Interaction Inspector (Last ${lastCount})`);
  console.log('================================================================\n');

  try {
    const interactions = db.prepare(`
      SELECT * FROM interaction_log
      ORDER BY ts DESC
      LIMIT ?
    `).all(lastCount) as any[];

    if (interactions.length === 0) {
      console.log('No interactions logged yet.');
      return;
    }

    // Print oldest to newest in the requested window
    for (const inter of interactions.reverse()) {
      console.log(`[Interaction ID: ${inter.id}] [${inter.ts}] [Channel: #${inter.channel}]`);
      console.log(`Prompt:   "${inter.prompt}"`);
      console.log(`Response: "${inter.response.replace(/\n/g, '\n          ')}"`);
      console.log(`Tokens:   ${inter.tokens_used || 'unknown'}`);
      
      // Fetch matching tool calls
      const tools = db.prepare(`
        SELECT * FROM tool_call_log
        WHERE interaction_log_id = ?
        ORDER BY ts ASC
      `).all(inter.id) as any[];

      if (tools.length > 0) {
        console.log('Tool Calls:');
        for (const t of tools) {
          const statusIndicator = t.status === 'success' ? '✅' : '❌';
          console.log(`  ${statusIndicator} [${t.tool_name}]`);
          console.log(`     Args:   ${t.args}`);
          console.log(`     Result: ${t.result.substring(0, 300)}${t.result.length > 300 ? '...' : ''}`);
        }
      }
      console.log('----------------------------------------------------------------\n');
    }
  } catch (error: any) {
    console.error('Error running inspection query:', error.message);
  } finally {
    db.close();
  }
}

// Simple argv parser
const lastIndex = process.argv.indexOf('--last');
let last = 5;
if (lastIndex !== -1 && process.argv[lastIndex + 1]) {
  last = parseInt(process.argv[lastIndex + 1], 10) || 5;
}

inspect(last);
