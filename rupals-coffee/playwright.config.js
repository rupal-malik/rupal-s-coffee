const fs = require('node:fs');
const { defineConfig } = require('@playwright/test');

// Use a system Chromium when one is provided (CI containers, sandboxes); otherwise Playwright's own browser.
const exe = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

module.exports = defineConfig({
  testDir: 'tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    launchOptions: exe ? { executablePath: exe, args: ['--no-sandbox'] } : {},
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: {
    command: 'node --no-warnings server/index.js',
    url: 'http://127.0.0.1:4173/api/health',
    env: { PORT: '4173', DB_PATH: ':memory:' },
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
