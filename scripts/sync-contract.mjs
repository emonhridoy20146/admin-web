#!/usr/bin/env node
// Copies the pinned contract from field-api docs into ./contract and extracts the master permission catalog
// (field-api/docs/02-requirements.md §3.1) to contract/permission-catalog.json.
// Usage: node scripts/sync-contract.mjs <path-to-field-api/docs>
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) {
  console.error('usage: sync-contract <field-api/docs dir>');
  process.exit(1);
}
fs.copyFileSync(path.join(src, 'openapi.yaml'), 'contract/openapi.yaml');
const md = fs.readFileSync(path.join(src, '02-requirements.md'), 'utf8');
const section = md.split('### 3.1 Keys')[1].split('### 3.2')[0];
const lines = section.split('\n').filter((l) => l.startsWith('|'));
// Columns are read from the header row, so a new role column (1.48.0 added AM = area_manager) does not shift
// the module column. "●" = on by default, "○" = off, "—" = never (cannot be granted to that role).
const ROLE_OF = { SA: 'super_admin', AM: 'area_manager', BM: 'branch_manager', FS: 'field_staff', VW: 'viewer' };
const header = lines[0].split('|').map((s) => s.trim());
const col = (name) => header.indexOf(name);
const roles = Object.entries(ROLE_OF).filter(([h]) => col(h) >= 0);
const rows = lines.filter((l) => l.startsWith('| `'));
const cell = (c) => (c.includes('●') ? true : c.includes('○') || c.includes('—') ? false : null);
const catalog = rows.map((l) => {
  const c = l.split('|').map((s) => s.trim());
  const key = c[col('Key')].match(/`([^`]+)`/)[1];
  const meaning = c[col('Meaning')];
  const neverFor = roles.filter(([h]) => c[col(h)].includes('—')).map(([, r]) => r);
  return {
    key,
    module: c[col('Module')],
    description: meaning.replace(/\*\*/g, '').trim(),
    added: /\[ADDED\]/.test(c[col('Key')]),
    reserved: /RESERVED/.test(meaning),
    defaults: Object.fromEntries(roles.map(([h, r]) => [r, cell(c[col(h)])])),
    ...(neverFor.length ? { neverFor } : {}),
  };
});
fs.writeFileSync('contract/permission-catalog.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(`contract synced: ${catalog.length} permission keys`);
