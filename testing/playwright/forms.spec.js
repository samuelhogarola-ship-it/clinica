import { expect, test } from "@playwright/test";
import {
  buildPageUrl,
  fillRequiredFields,
  installSeriousErrorTracking,
  loadStarterConfig,
  submitConfiguredForm
} from "./helpers.js";

const starterConfig = await loadStarterConfig();

test.describe("forms", () => {
  test.skip(starterConfig.forms.length === 0, "No forms configured");

  for (const formConfig of starterConfig.forms) {
    test(`form ${formConfig.path}`, async ({ page }, testInfo) => {
      const assertNoSeriousErrors = installSeriousErrorTracking(page, starterConfig, testInfo);
      await page.goto(buildPageUrl(starterConfig.baseUrl, formConfig.path), { waitUntil: "domcontentloaded" });

      const form = page.locator(formConfig.formSelector).first();
      await expect(form).toBeVisible();

      const requiredFields = form.locator(
        'input[required], textarea[required], select[required], [aria-required="true"]'
      );
      const requiredFieldsCount = await requiredFields.count();

      if (formConfig.requireRequiredFields) {
        expect(requiredFieldsCount, `Expected required fields on ${formConfig.path}`).toBeGreaterThan(0);
        const nativeValidationState = await form.evaluate((node) => {
          if (!(node instanceof HTMLFormElement)) {
            return true;
          }

          return node.reportValidity();
        });

        expect(nativeValidationState, `Expected native validation to fail on ${formConfig.path}`).toBe(
          false
        );
      }

      await fillRequiredFields(form);

      if (formConfig.submit.mode !== "none") {
        await submitConfiguredForm(page, form, formConfig);
      }

      expect(await assertNoSeriousErrors(), "Found serious browser errors").toEqual([]);
    });
  }
});
