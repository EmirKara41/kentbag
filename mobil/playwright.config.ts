import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/ui",
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: "http://localhost:4174",
    channel: "msedge",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    permissions: ["geolocation"],
    geolocation: { latitude: 40.545, longitude: 41.994, accuracy: 12 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "node node_modules/tsx/dist/cli.mjs ../sunucu/tests/mobile-server.ts",
      url: "http://localhost:4311/api/health",
      env: { KENT_INTEGRATION_TEST: "1" },
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "npm run dev -- --port 4174",
      url: "http://localhost:4174",
      env: { VITE_API_URL: "http://localhost:4311" },
      reuseExistingServer: false,
    },
  ],
});
