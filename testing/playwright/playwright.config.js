import { defineConfig } from "@playwright/test";
import { loadStarterConfig } from "./helpers.js";

const starterConfig = await loadStarterConfig();

export default defineConfig({
  testDir: "./",
  testMatch: ["smoke.spec.js", "navigation.spec.js", "seo.spec.js", "forms.spec.js"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html"]],
  webServer: starterConfig.webServer,
  use: {
    baseURL: starterConfig.baseUrl,
    trace: "retain-on-failure",
    video: "off",
    screenshot: "only-on-failure"
  }
});
