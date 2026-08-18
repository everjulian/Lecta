import { test, expect } from './fixtures/lecta-app';
import { createSession, finishRecording, transcribe } from './fixtures/flows';
import { expectNoSeriousA11yViolations } from './fixtures/accessibility';

test('creates, records, pauses, resumes and finishes a session', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Biblioteca', exact: true })).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.getByRole('button', { name: 'Nueva sesión' }).click();
  await expectNoSeriousA11yViolations(page);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await createSession(page, {
    title: 'Arquitectura E2E',
    type: 'Clase',
    subject: 'Ingeniería de Software',
  });
  await finishRecording(page);
  await expect(page.getByRole('button', { name: 'Mostrar archivo' })).toBeEnabled();
  await expectNoSeriousA11yViolations(page);
});

test('persists sessions after closing and reopening with the same userData', async ({
  lecta,
  page,
}) => {
  await createSession(page, { title: 'Sesión persistente', type: 'Reunión', subject: 'Lecta' });
  const reopened = await lecta.restart();
  await expect(reopened.getByRole('heading', { name: 'Biblioteca' })).toBeVisible();
  await expect(reopened.getByRole('button', { name: /Sesión persistente/ }).first()).toBeVisible();
});

test('transcribes a fixture recording and renders deterministic segments', async ({ page }) => {
  await createSession(page, { title: 'Transcripción fixture' });
  await finishRecording(page);
  await transcribe(page);
  await expect(page.getByText('La tarea es estudiar puertos y adaptadores')).toBeVisible();
  await expect(page.getByRole('button', { name: '00:00:01' })).toBeVisible();
});

test('generates structured notes with summary, concepts, tasks and questions', async ({ page }) => {
  await createSession(page, { title: 'Notas fixture' });
  await finishRecording(page);
  await transcribe(page);
  await page.getByRole('tab', { name: 'Resumen' }).click();
  await page.getByRole('button', { name: 'Generar apuntes' }).click();
  await expect(page.getByText('La sesión explica Clean Architecture')).toBeVisible();
  await page.getByRole('tab', { name: 'Apuntes' }).click();
  await expect(page.getByRole('article').filter({ hasText: /^Clean Architecture$/ })).toBeVisible();
  await expect(page.getByText('Estudiar los límites arquitectónicos')).toBeVisible();
  await expect(page.getByText('¿Por qué el dominio no depende de infraestructura?')).toBeVisible();
});

test('searches, filters, paginates and opens library sessions', async ({ page }) => {
  for (let index = 1; index <= 13; index += 1) {
    await createSession(page, {
      title: `Biblioteca ${index.toString().padStart(2, '0')}`,
      type: index % 2 === 0 ? 'Reunión' : 'Clase',
      subject: index % 2 === 0 ? 'Proyecto E2E' : 'Materia E2E',
      tags: index === 13 ? 'arquitectura, examen' : undefined,
    });
    await page.getByRole('button', { name: '← Volver a sesiones' }).click();
  }

  const search = page.getByPlaceholder('Buscar en títulos, transcripciones y apuntes');
  await search.fill('Biblioteca 13');
  await expect(page.getByRole('button', { name: /Biblioteca 13/ })).toBeVisible();
  await expect(page.getByText('1 sesión')).toBeVisible();

  await search.clear();
  await page.getByLabel('Tipo').selectOption('MEETING');
  await page.getByLabel('Materia o proyecto').selectOption('Proyecto E2E');
  await expect(page.getByText('6 sesiones')).toBeVisible();

  await page.getByLabel('Tipo').selectOption('');
  await page.getByLabel('Materia o proyecto').selectOption('');
  await expect(page.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  const library = page.getByRole('region', { name: 'Todas las sesiones' });
  await library.getByRole('button').first().click();
  await expect(page.getByRole('button', { name: 'Grabar' })).toBeVisible();
});

test('answers from local knowledge with source and opens its timestamp', async ({ page }) => {
  await createSession(page, { title: 'Fuente Clean Architecture' });
  await finishRecording(page);
  await transcribe(page);
  await page.getByRole('button', { name: '← Volver a sesiones' }).click();

  await page.getByLabel('¿Qué quieres encontrar?').fill('¿Dónde se explicó Clean Architecture?');
  await page.getByRole('button', { name: 'Preguntar' }).click();
  await expect(page.getByText('Clean Architecture fue explicada')).toBeVisible();
  const source = page.getByRole('button', { name: /00:00:01.*Reproducir/ });
  await expect(source).toBeVisible();
  await expect(page.getByRole('article').filter({ has: source })).toContainText(
    'Fuente Clean Architecture',
  );
  await expectNoSeriousA11yViolations(page);
  await source.click();
  await expect(page.getByRole('heading', { name: 'Fuente Clean Architecture' })).toBeVisible();
  await expect(page.getByText('Contenido de la sesión')).toBeVisible();
});

test.describe('recoverable failures', () => {
  test.describe('transcription provider failure', () => {
    test.use({ e2eScenario: 'transcription-failure' });
    test('keeps the window interactive', async ({ page }) => {
      await createSession(page, { title: 'Error de transcripción' });
      await finishRecording(page);
      await page.getByRole('tab', { name: 'Transcripción' }).click();
      await page.getByRole('button', { name: 'Transcribir ahora' }).click();
      await expect(page.getByText('Fixture: la transcripción falló')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Reiniciar transcripción' })).toBeEnabled();
      await expectNoSeriousA11yViolations(page);
    });
  });

  test.describe('missing recording', () => {
    test.use({ e2eScenario: 'missing-recording' });
    test('reports the missing file without corrupting the session', async ({ page }) => {
      await createSession(page, { title: 'Grabación ausente' });
      await finishRecording(page);
      await page.getByRole('tab', { name: 'Transcripción' }).click();
      await page.getByRole('button', { name: 'Transcribir ahora' }).click();
      await expect(page.getByText('Fixture: no encontramos el archivo')).toBeVisible();
      await expect(page.getByRole('button', { name: '← Volver a sesiones' })).toBeEnabled();
    });
  });

  test.describe('AI timeout', () => {
    test.use({ e2eScenario: 'ai-timeout' });
    test('shows a retryable notes error and preserves the transcript', async ({ page }) => {
      await createSession(page, { title: 'Timeout de IA' });
      await finishRecording(page);
      await transcribe(page);
      await page.getByRole('tab', { name: 'Resumen' }).click();
      await page.getByRole('button', { name: 'Generar apuntes' }).click();
      await expect(page.getByText('Fixture: la generación superó')).toBeVisible();
      await page.getByRole('tab', { name: 'Transcripción' }).click();
      await expect(page.getByText('Clean Architecture separa las reglas')).toBeVisible();
    });
  });

  test.describe('knowledge failure', () => {
    test.use({ e2eScenario: 'knowledge-failure' });
    test('shows a recoverable error and leaves Home interactive', async ({ page }) => {
      await page.getByLabel('¿Qué quieres encontrar?').fill('pregunta de fallo');
      await page.getByRole('button', { name: 'Preguntar' }).click();
      await expect(page.getByRole('alert')).toContainText('Puedes intentarlo nuevamente');
      await expect(page.getByRole('button', { name: 'Nueva sesión' })).toBeEnabled();
      await expectNoSeriousA11yViolations(page);
    });
  });
});
