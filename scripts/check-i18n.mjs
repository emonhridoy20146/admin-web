#!/usr/bin/env node
// CLAUDE.md §2.9: bn.json and en.json must have the same keys (per feature namespace and shared common),
// and no value may be empty in one language but not the other.
import fs from 'node:fs';
import path from 'node:path';

function flatten(obj, prefix = '', out = {}) {
  if (Array.isArray(obj)) {
    out[prefix] = `[array:${obj.length}]`;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

const pairs = [['src/shared/i18n/common.bn.json', 'src/shared/i18n/common.en.json']];
for (const f of fs.readdirSync('src/features')) {
  const dir = path.join('src/features', f, 'i18n');
  if (fs.existsSync(dir)) pairs.push([path.join(dir, 'bn.json'), path.join(dir, 'en.json')]);
}

const problems = [];
let keys = 0;
for (const [bnFile, enFile] of pairs) {
  if (!fs.existsSync(bnFile) || !fs.existsSync(enFile)) {
    problems.push(`${path.dirname(bnFile)}: both bn.json and en.json are required`);
    continue;
  }
  const bn = flatten(JSON.parse(fs.readFileSync(bnFile, 'utf8')));
  const en = flatten(JSON.parse(fs.readFileSync(enFile, 'utf8')));
  for (const k of Object.keys(en)) if (!(k in bn)) problems.push(`${bnFile}: missing "${k}"`);
  for (const k of Object.keys(bn)) if (!(k in en)) problems.push(`${enFile}: missing "${k}"`);
  for (const k of Object.keys(en)) {
    if (!(k in bn)) continue;
    if ((en[k] === '') !== (bn[k] === '')) problems.push(`${bnFile}: "${k}" is empty in one language only`);
    if (String(en[k]).startsWith('[array') && en[k] !== bn[k]) problems.push(`${bnFile}: "${k}" array length differs`);
    const vars = (s) => [...String(s).matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort().join();
    if (vars(en[k]) !== vars(bn[k])) problems.push(`${bnFile}: "${k}" interpolation variables differ (${vars(bn[k])} vs ${vars(en[k])})`);
    keys++;
  }
}

if (problems.length) {
  console.error(`check:i18n failed (${problems.length}):\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`check:i18n ok — ${pairs.length} namespaces, ${keys} keys in parity.`);
