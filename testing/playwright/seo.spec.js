import { expect, test } from "@playwright/test";
import { buildPageUrl, installSeriousErrorTracking, loadStarterConfig } from "./helpers.js";

const starterConfig = await loadStarterConfig();

test.describe("seo", () => {
  test.skip(!starterConfig.seo.enabled, "SEO checks disabled in config");

  for (const routePath of starterConfig.pages) {
    test(`seo ${routePath}`, async ({ page }, testInfo) => {
      const assertNoSeriousErrors = installSeriousErrorTracking(page, starterConfig, testInfo);
      await page.goto(buildPageUrl(starterConfig.baseUrl, routePath), { waitUntil: "domcontentloaded" });

      await expect(page).toHaveTitle(/\S+/);

      if (starterConfig.seo.requireMetaDescription) {
        const description = page.locator('meta[name="description"]').first();
        await expect(description).toHaveAttribute("content", /\S+/);
      }

      if (starterConfig.seo.requireCanonical) {
        const canonical = page.locator('link[rel="canonical"]').first();
        await expect(canonical).toHaveAttribute("href", /https?:\/\/|^\//);
      }

      if (starterConfig.seo.requireSingleH1) {
        await expect(page.locator("h1")).toHaveCount(1);
      } else {
        await expect(page.locator("h1").first()).toBeVisible();
      }

      expect(await assertNoSeriousErrors(), "Found serious browser errors").toEqual([]);
    });
  }
});
