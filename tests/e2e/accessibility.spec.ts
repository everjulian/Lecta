import { test, expect } from './fixtures/lecta-app';
import { createSession } from './fixtures/flows';
import { expectNoSeriousA11yViolations } from './fixtures/accessibility';

test('traps modal focus, restores it, and supports Escape and Enter', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Nueva sesión' });
  await trigger.focus();
  await trigger.click();

  const title = page.getByLabel('Título');
  await expect(title).toBeFocused();
  await title.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.getByLabel('Título').fill('Sesión por teclado');
  await page.getByLabel('Título').press('Enter');
  await expect(page.getByRole('heading', { name: 'Sesión por teclado' })).toBeVisible();
});

test('operates recorder with Enter and Space without relying on color', async ({ page }) => {
  await createSession(page, { title: 'Grabación accesible' });
  const record = page.getByRole('button', { name: 'Grabar' });
  await record.focus();
  await record.press('Space');
  await expect(page.getByRole('status')).toContainText('Grabando');
  await expectNoSeriousA11yViolations(page);

  const pause = page.getByRole('button', { name: 'Pausar' });
  await pause.focus();
  await pause.press('Enter');
  await expect(page.getByRole('status')).toContainText('Pausado');

  const resume = page.getByRole('button', { name: 'Reanudar' });
  await resume.focus();
  await resume.press('Space');
  await expect(page.getByRole('status')).toContainText('Grabando');
  await page.getByRole('button', { name: 'Finalizar' }).click();
});

test('supports ArrowLeft, ArrowRight, Home and End in material tabs', async ({ page }) => {
  await createSession(page, { title: 'Tabs accesibles' });
  await page.getByRole('button', { name: 'Grabar' }).click();
  await page.getByRole('button', { name: 'Finalizar' }).click();

  const summary = page.getByRole('tab', { name: 'Resumen' });
  await summary.focus();
  await summary.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Apuntes' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Audio' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(summary).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab', { name: 'Audio' })).toHaveAttribute('aria-selected', 'true');
});

test('respects reduced motion and reflows at an equivalent 200% zoom viewport', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
    true,
  );

  await page.setViewportSize({ width: 550, height: 700 });
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBe(false);
  await expectNoSeriousA11yViolations(page);
});
