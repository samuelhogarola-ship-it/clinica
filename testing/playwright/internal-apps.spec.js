import { expect, test } from "@playwright/test";
import { buildPageUrl, installSeriousErrorTracking, loadStarterConfig } from "./helpers.js";

const starterConfig = await loadStarterConfig();

test.describe("internal apps split", () => {
  test("fisio route shows clinical workspace without admin queue", async ({ page }, testInfo) => {
    const assertNoSeriousErrors = installSeriousErrorTracking(page, starterConfig, testInfo);

    await page.goto(buildPageUrl(starterConfig.baseUrl, "/fisio"), { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /^App Fisio$/i })).toBeVisible();
    await expect(page.getByText(/panel admin clinica/i)).toHaveCount(0);
    await expect(page.getByText(/revisión de envíos pendientes/i)).toHaveCount(0);
    await expect(page.getByText(/introduce la contraseña/i)).toHaveCount(0);

    expect(await assertNoSeriousErrors(), "Found serious browser errors").toEqual([]);
  });

  test("admin route shows admin dashboard without legacy patient workspace", async ({ page }, testInfo) => {
    const assertNoSeriousErrors = installSeriousErrorTracking(page, starterConfig, testInfo);

    await page.goto(buildPageUrl(starterConfig.baseUrl, "/admin"), { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/hola .* esto es lo que te espera hoy/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Facturas$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Pacientes$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Resumen$/ })).toBeVisible();
    await expect(page.getByText(/tareas pendientes de hoy/i)).toBeVisible();
    await expect(page.getByText(/introduce la contraseña/i)).toHaveCount(0);

    expect(await assertNoSeriousErrors(), "Found serious browser errors").toEqual([]);
  });
});
