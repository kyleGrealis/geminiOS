import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';

// In Node.js, we can read the env using dotenv or similar.
// Since we want this to be simple and flat, let's write a simple helper that parses the local .env file.
const envPath = path.resolve(import.meta.dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > 0) {
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      process.env[key] = val;
    }
  }
}

const PERSONA_PATH = path.resolve(import.meta.dirname, '../config/qwerty-persona.md');
const PERMISSIONS_PATH = path.resolve(import.meta.dirname, '../config/permissions.yaml');

export interface PermissionsConfig {
  default: {
    model: string;
    thinking_level: number;
  };
  channels?: {
    [channelName: string]: {
      model: string;
      thinking_level: number;
    };
  };
  tools: {
    allow: string[];
    deny: string[];
  };
  bash: {
    allow: string[];
    deny: string[];
  };
}

let lastPermissionsMtime = 0;
let cachedPermissions: PermissionsConfig | null = null;

export function getPermissions(): PermissionsConfig {
  try {
    const stat = fs.statSync(PERMISSIONS_PATH);
    const mtime = stat.mtimeMs;
    if (!cachedPermissions || mtime !== lastPermissionsMtime) {
      const fileContent = fs.readFileSync(PERMISSIONS_PATH, 'utf8');
      cachedPermissions = yaml.load(fileContent) as PermissionsConfig;
      lastPermissionsMtime = mtime;
      console.log('[Config] Hot-loaded permissions.yaml');
    }
    return cachedPermissions;
  } catch (error) {
    console.error('[Config] Failed to load permissions.yaml, using defaults:', error);
    return {
      default: { model: 'gemini-2.5-flash', thinking_level: 0 },
      tools: { allow: [], deny: [] },
      bash: { allow: [], deny: [] }
    };
  }
}

export function getSystemInstructions(): string {
  try {
    if (fs.existsSync(PERSONA_PATH)) {
      return fs.readFileSync(PERSONA_PATH, 'utf8');
    }
  } catch (error) {
    console.error('[Config] Failed to read qwerty-persona.md:', error);
  }
  return 'You are Qwerty, Kyle\'s personal assistant and sysadmin.';
}
