#!/usr/bin/env node
// CLAUDE.md §2.4: every permission key used in the UI must exist in the master catalog (contract/permission-catalog.json),
// and reserved keys (microfinance) must not be used at all.
import fs from 'node:fs';
import path from 'node:path';

const catalog = JSON.parse(fs.readFileSync('contract/permission-catalog.json', 'utf8'));
const known = new Map(catalog.map((p) => [p.key, p]));
const PATTERNS = [
  /\bpermission[s]?\s*[:=]\s*['"]([a-z][a-z0-9_.]+)['"]/g, // permission: 'x' / permission="x"
  /\buseCan\(\s*['"]([a-z][a-z0-9_.]+)['"]/g,
  /\bcan\(\s*['"]([a-z][a-z0-9_.]+)['"]/g,
];
const LIST = /\bpermissions\s*:\s*\[([^\]]*)\]/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'test') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

const problems = [];
let used = 0;
for (const file of walk('src')) {
  const src = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  for (const re of PATTERNS) for (const m of src.matchAll(re)) keys.add(m[1]);
  for (const m of src.matchAll(LIST)) for (const k of m[1].matchAll(/['"]([a-z][a-z0-9_.]+)['"]/g)) keys.add(k[1]);
  for (const k of keys) {
    used++;
    const def = known.get(k);
    if (!def) problems.push(`${file}: unknown permission "${k}"`);
    else if (def.reserved) problems.push(`${file}: reserved permission "${k}" must not be used`);
  }
}

if (problems.length) {
  console.error(`check:permissions failed (${problems.length}):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check:permissions ok — ${used} references, all in the master catalog (${known.size} keys).`);
