import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/');
  await page.getByPlaceholder('Usuario').fill('susana');
  await page.getByPlaceholder('Contraseña').fill('testpass');
  await page.getByRole('button', { name: /acceder/i }).click();
  await expect(page.getByText('Buscar paciente')).toBeVisible();
}

test('login screen is shown to unauthenticated users', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /acceso protegido/i })).toBeVisible();
  await expect(page.getByPlaceholder('Usuario')).toBeVisible();
  await expect(page.getByPlaceholder('Contraseña')).toBeVisible();
});

test('a clinician can authenticate and see the patient hub', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('button', { name: /crear paciente/i })).toBeVisible();
  await expect(page.getByText(/no hay pacientes guardados|total de pacientes disponibles/i)).toBeVisible();
});

test('a clinician can create a patient and open the record view', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: /crear paciente/i }).click();
  await expect(page.getByRole('heading', { name: /nuevo paciente/i })).toBeVisible();

  const patientId = 'PT' + Date.now().toString().slice(-6);
  await page.getByPlaceholder('ej: 4F92K').fill(patientId);
  await page.getByPlaceholder('ej: 15/03/1985').fill('15/03/1985');
  await page.getByRole('button', { name: /crear y abrir/i }).click();

  await expect(page.getByText('Registro de fisioterapia')).toBeVisible();
  await expect(page.getByText(patientId)).toBeVisible();
  await expect(page.getByRole('button', { name: /generar pdf/i })).toBeVisible();
});
