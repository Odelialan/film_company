import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    headless: true,
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure"
  },
  reporter: [["list"]]
});
