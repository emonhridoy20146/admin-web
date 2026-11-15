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
const rows = section.split('\n').filter((l) => l.startsWith('| `'));
const cell = (c) => (c.includes('●') ? true : c.includes('○') ? false : null);
const catalog = rows.map((l) => {
  const c = l.split('|').map((s) => s.trim());
  const key = c[1].match(/`([^`]+)`/)[1];
  const reserved = /RESERVED/.test(c[2]);
  return {
    key,
    module: c[7],
    description: c[2].replace(/\*\*/g, '').trim(),
    added: /\[ADDED\]/.test(c[1]),
    reserved,
    defaults: { super_admin: cell(c[3]), branch_manager: cell(c[4]), field_staff: cell(c[5]), viewer: cell(c[6]) },
  };
});
fs.writeFileSync('contract/permission-catalog.json', JSON.stringify(catalog, null, 2) + '\n');
console.log(`contract synced: ${catalog.length} permission keys`);
