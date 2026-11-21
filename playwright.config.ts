import { defineConfig, devices } from '@playwright/test';

/**
 * E2E runs against the static export in mock mode (`pnpm build:mock`), served the way production hosting must
 * serve it (scripts/serve-static.mjs: rewrites + CSP with script hashes). Staging runs set E2E_BASE_URL instead.
 */
const PORT = 4173;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
export default defineConfig({
  testDir: 'e2e/journeys',
  outputDir: 'e2e/.results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    // The panel opens in English; the journeys assert the Bangla screens, so every test starts with Bangla chosen.
    storageState: { cookies: [], origins: [{ origin: BASE_URL, localStorage: [{ name: 'fos.ui', value: JSON.stringify({ locale: 'bn', bnDigits: true }) }] }] },
    timezoneId: 'Asia/Dhaka',
    locale: 'bn-BD',
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testMatch: /mobile\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `node scripts/serve-static.mjs ${PORT}`, port: PORT, reuseExistingServer: !process.env.CI },
});
