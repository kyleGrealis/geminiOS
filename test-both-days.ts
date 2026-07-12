import { runAgentTurn } from './src/agent.ts';
import * as fs from 'fs';

const blueprintContent = fs.readFileSync('blueprints/morning-report.md', 'utf8');

console.log('=== SIMULATING FRIDAY, JULY 3, 2026 ===');
const blueprintFriday = blueprintContent + '\n\nIMPORTANT: For this test run, act as if today is Friday, July 3, 2026.';
const resultFriday = await runAgentTurn('weather', blueprintFriday);
console.log(resultFriday.text);

console.log('\n=======================================\n');

console.log('=== SIMULATING SATURDAY, JULY 4, 2026 (WEEKEND) ===');
const blueprintSaturday = blueprintContent + '\n\nIMPORTANT: For this test run, act as if today is Saturday, July 4, 2026.';
const resultSaturday = await runAgentTurn('weather', blueprintSaturday);
console.log(resultSaturday.text);

process.exit(0);
