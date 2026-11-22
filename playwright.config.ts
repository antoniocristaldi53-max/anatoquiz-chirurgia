import { defineConfig, devices } from '@playwright/test';

// Test end-to-end sulla build di produzione (vite preview), con viewport iPhone.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    locale: 'it-IT',
  },
  projects: [
    // Safari/WebKit con profilo iPhone: flusso completo
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] }, testIgnore: /offline/ },
    // Il controllo del service worker in modalità offline usa Chromium con viewport iPhone
    { name: 'iphone-chromium-offline', use: { ...devices['iPhone 13'], browserName: 'chromium' }, testMatch: /offline/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
