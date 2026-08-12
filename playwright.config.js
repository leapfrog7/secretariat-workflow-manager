import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'small-android', use: { ...devices['Galaxy S9+'], browserName: 'chromium', viewport: { width: 360, height: 740 } } },
    { name: 'modern-iphone', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run dev:web -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      VITE_NEON_AUTH_URL: '',
      VITE_NEON_DATA_API_URL: '',
      VITE_API_BASE_URL: 'http://127.0.0.1:3000',
      VITE_WEB_PUSH_PUBLIC_KEY: '',
    },
  },
});
