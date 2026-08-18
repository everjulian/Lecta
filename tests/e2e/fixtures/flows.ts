import { expect, type Page } from '@playwright/test';

export async function createSession(
  page: Page,
  input: { title: string; type?: 'Clase' | 'Reunión' | 'Otro'; subject?: string; tags?: string },
): Promise<void> {
  await page.getByRole('button', { name: 'Nueva sesión' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Qué vas a registrar?' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Título').fill(input.title);
  if (input.type) await dialog.getByRole('radio', { name: input.type }).check();
  if (input.subject) {
    const subjectLabel = input.type === 'Reunión' ? 'Proyecto Opcional' : 'Materia Opcional';
    await dialog.getByLabel(subjectLabel).fill(input.subject);
  }
  if (input.tags) await dialog.getByLabel(/Tags/).fill(input.tags);
  await dialog.getByRole('button', { name: 'Crear sesión' }).click();
  await expect(page.getByRole('heading', { name: input.title })).toBeVisible();
}

export async function finishRecording(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Grabar' }).click();
  await expect(page.getByText('Grabando', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByText('Pausado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reanudar' }).click();
  await expect(page.getByText('Grabando', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Finalizar' }).click();
  await expect(page.getByText('Completada', { exact: true })).toBeVisible();
}

export async function transcribe(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Transcripción' }).click();
  await page.getByRole('button', { name: 'Transcribir ahora' }).click();
  await expect(page.getByText('Clean Architecture separa las reglas')).toBeVisible();
}
