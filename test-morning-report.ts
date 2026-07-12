import { runAgentTurn } from './src/agent.ts';
import * as fs from 'fs';

const blueprintContent = fs.readFileSync('blueprints/morning-report.md', 'utf8') + '\n\nIMPORTANT: For this test run, act as if today is Friday, July 3, 2026.';
console.log('Running agent turn with morning-report.md (Simulated Weekday July 3 to check debugging output)...');
const result = await runAgentTurn('weather', blueprintContent);
console.log('\n--- RESULT ---');
console.log(result.text);
process.exit(0);
