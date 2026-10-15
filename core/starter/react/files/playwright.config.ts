import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:4173';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  // FORGE_SHOTS=1: a picture of each test's last screen, which the QA engineer keeps with forge shot --playwright.
  use: { baseURL, trace: 'on-first-retry', screenshot: process.env.FORGE_SHOTS ? 'on' : 'off' },
  // The production build, as users get it; /v1 is proxied to API_URL (vite.config.ts).
  webServer: process.env.BASE_URL ? undefined : { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: baseURL, reuseExistingServer: !process.env.CI },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
