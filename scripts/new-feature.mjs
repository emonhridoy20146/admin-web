#!/usr/bin/env node
// Scaffolds src/features/<name> with manifest, index, page, api, model, i18n and a test (CLAUDE.md §5).
// Usage: pnpm new:feature <name> [--flag module.x] [--route /path] [--permission key]
import fs from 'node:fs';
import path from 'node:path';

const [name, ...rest] = process.argv.slice(2);
if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error('usage: pnpm new:feature <kebab-name> [--flag module.x] [--route /path] [--permission key]');
  process.exit(1);
}
const opt = (k, d) => {
  const i = rest.indexOf(`--${k}`);
  return i >= 0 ? rest[i + 1] : d;
};
const flag = opt('flag', `module.${name}`);
const route = opt('route', `/${name}`);
const permission = opt('permission', '');
const pascal = name.replace(/(^|-)(\w)/g, (_m, _d, c) => c.toUpperCase());
const camel = pascal[0].toLowerCase() + pascal.slice(1);
const dir = path.join('src/features', name);
if (fs.existsSync(dir)) {
  console.error(`${dir} already exists`);
  process.exit(1);
}
const files = {
  'manifest.ts': `import { Box } from 'lucide-react';
import type { FeatureManifest } from '@/shared/feature/types';
import bn from './i18n/bn.json';
import en from './i18n/en.json';

export const ${camel}Manifest: FeatureManifest = {
  name: '${name}',
  flag: '${flag}',
  routes: [{ path: '${route}', title: '${name}:title',${permission ? ` permission: '${permission}',` : ''} navGroup: 'field', icon: Box, order: 90 }],
  permissions: [${permission ? `'${permission}'` : ''}],
  messages: { bn, en },
};
`,
  'index.ts': `export { ${camel}Manifest } from './manifest';\nexport { ${pascal}Page } from './pages/${name}-page';\n`,
  [`pages/${name}-page.tsx`]: `'use client';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/shared/ui/page';

export function ${pascal}Page() {
  const { t } = useTranslation('${name}');
  return <PageHeader title={t('title')}><span>{t('subtitle')}</span></PageHeader>;
}
`,
  'api/.gitkeep': '',
  'model/.gitkeep': '',
  'components/.gitkeep': '',
  'i18n/en.json': JSON.stringify({ title: pascal, subtitle: '' }, null, 2) + '\n',
  'i18n/bn.json': JSON.stringify({ title: pascal, subtitle: '' }, null, 2) + '\n',
  [`__tests__/${name}.test.ts`]: `import { describe, expect, it } from 'vitest';\nimport { ${camel}Manifest } from '../manifest';\n\ndescribe('${name}', () => {\n  it('has a manifest', () => expect(${camel}Manifest.name).toBe('${name}'));\n});\n`,
};
for (const [f, c] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
  fs.writeFileSync(path.join(dir, f), c);
}
const routeDir = path.join('src/app/(shell)', route);
fs.mkdirSync(routeDir, { recursive: true });
fs.writeFileSync(path.join(routeDir, 'page.tsx'), `'use client';\nimport { ${pascal}Page } from '@/features/${name}';\n\nexport default ${pascal}Page;\n`);
console.log(`Created ${dir} and ${routeDir}/page.tsx.
Next: register ${camel}Manifest in src/app/features.ts, translate i18n/bn.json, then pnpm check:permissions && pnpm check:i18n.`);
