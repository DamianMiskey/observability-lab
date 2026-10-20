import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (e2e/). By default they start the production build
// (`npm start`, so run `npm run build` first). Set BASE_URL to test a
// deployment instead; then only tests tagged @readonly (and @deployed) run:
//   BASE_URL=https://obs.djmiskey.com npm run e2e
// Locally the browser is the installed Microsoft Edge; CI installs Chromium.
const CI = !!process.env.CI;
const LIVE = !!process.env.BASE_URL;
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3400";
const channel = CI ? undefined : "msedge";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: CI,
  // Over the network a request can blip; a pass on retry is reported as flaky.
  retries: CI || LIVE ? 1 : 0,
  workers: CI || LIVE ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  grep: LIVE ? /@readonly|@deployed/ : undefined,
  grepInvert: LIVE ? undefined : /@deployed/,
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel }, testMatch: /pages\.spec/ },
  ],
  webServer: LIVE ? undefined : { command: "npm start -- -p 3400", url: BASE_URL, reuseExistingServer: !CI, timeout: 60_000 },
});
