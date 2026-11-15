import { FlatCompat } from '@eslint/eslintrc';
import boundaries from 'eslint-plugin-boundaries';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'next-env.d.ts', 'public/mockServiceWorker.js', 'src/shared/api/schema.d.ts', 'e2e/.results/**', 'playwright-report/**', 'test-results/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        { type: 'app', pattern: 'src/app/**' },
        { type: 'feature', pattern: 'src/features/*', capture: ['feature'], mode: 'folder' },
        { type: 'shared', pattern: 'src/shared/**' },
        { type: 'test', pattern: 'src/test/**' },
      ],
      'import/resolver': { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      // app → features(index) → shared; features talk to each other only through index.ts; shared imports no feature.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'app', allow: ['feature', 'shared', 'test'] },
            { from: 'feature', allow: ['shared', 'feature'] },
            { from: 'shared', allow: ['shared'] },
            { from: 'test', allow: ['shared', 'test'] },
          ],
        },
      ],
      'boundaries/entry-point': [
        'error',
        {
          default: 'allow',
          rules: [{ target: ['feature'], disallow: ['**'], importKind: 'value' }, { target: ['feature'], allow: ['index.ts'] }],
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'dangerouslySetInnerHTML is forbidden (CSP / XSS, CLAUDE.md §2.8).' },
        { selector: "CallExpression[callee.property.name='toLocaleString']", message: 'Use shared/lib/format.ts, never toLocaleString ad hoc.' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
];

export default config;
