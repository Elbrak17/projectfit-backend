// Minimal .env loader (no dependency): reads <cwd>/.env on import.
// Priority: real environment wins; .env only fills missing keys.
// Never logs values. Safe to import multiple times.
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (k) out[k] = v;
  }
  return out;
}

try {
  const p = join(process.cwd(), '.env');
  if (existsSync(p)) {
    const parsed = parseEnv(readFileSync(p, 'utf8'));
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined || process.env[k] === '') {
        process.env[k] = v;
      }
    }
  }
} catch {
  // .env optional — snapshot-first defaults apply.
}
