import { expect, test } from "@playwright/test";
import { buildPageUrl, installSeriousErrorTracking, loadStarterConfig } from "./helpers.js";

const starterConfig = await loadStarterConfig();

test.describe("static registration", () => {
  test("submits registro.html with a stubbed Edge Function and resets the form", async ({ page }, testInfo) => {
    const assertNoSeriousErrors = installSeriousErrorTracking(page, starterConfig, testInfo);

    await page.route("**/functions/v1/submit-fisio-intake", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          registry_number: "REG-TEST-002",
          matched_existing_profile: true,
          profile_id: "profile-test-002",
          submission_id: "submission-test-002",
          download_url: "https://example.com/generated.pdf",
          storage_path: "REG-TEST-002/submission-test-002/2026-05-31-generated.pdf"
        })
      });
    });

    await page.goto(buildPageUrl(starterConfig.baseUrl, "/registro.html"), { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /ficha fisioter.*pdf/i })).toBeVisible();

    const submitButton = page.getByRole("button", { name: /guardar ficha y descargar pdf/i });
    await expect(submitButton).toBeDisabled();

    await page.getByLabel("Nombre *").fill("Lucia");
    await page.getByLabel("Apellidos *").fill("Martinez");
    await page.getByLabel("Teléfono *").fill("600123123");
    await page.getByLabel("Email").fill("lucia@example.com");
    await page.getByLabel("Acepto el tratamiento de datos personales conforme al RGPD.").check();
    await page.getByLabel("He leído y acepto la política de privacidad de la clínica.").check();

    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await expect(page.locator("main")).toContainText("Registro guardado con el código");
    await expect(page.locator("main")).toContainText("reutilizando un perfil existente.");
    await expect(page.getByRole("link", { name: /descargar pdf/i })).toBeVisible();

    await expect(page.getByLabel("Nombre *")).toHaveValue("");
    await expect(page.getByLabel("Apellidos *")).toHaveValue("");
    await expect(page.getByLabel("Teléfono *")).toHaveValue("");
    await expect(page.getByLabel("Acepto el tratamiento de datos personales conforme al RGPD.")).not.toBeChecked();
    await expect(page.getByLabel("He leído y acepto la política de privacidad de la clínica.")).not.toBeChecked();

    expect(await assertNoSeriousErrors(), "Found serious browser errors").toEqual([]);
  });
});
