import {
  _electron as electron,
  test as base,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { E2EScenario } from '../../../apps/desktop/main/e2e/e2e-config';

const projectRoot = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const electronModule = createRequire(import.meta.url)('electron') as unknown;
if (typeof electronModule !== 'string') throw new Error('Electron executable path is unavailable');
const electronPath = electronModule;

interface RunningApp {
  readonly application: ElectronApplication;
  readonly page: Page;
  readonly pid: number;
}

export class LectaHarness {
  private running: RunningApp | null = null;

  constructor(
    readonly userDataPath: string,
    private readonly scenario: E2EScenario,
  ) {}

  async launch(): Promise<Page> {
    if (this.running) throw new Error('Lecta is already running in this test');
    const application = await electron.launch({
      executablePath: electronPath,
      args: [projectRoot],
      cwd: projectRoot,
      offline: true,
      env: e2eEnvironment(this.userDataPath, this.scenario),
      timeout: 30_000,
    });
    const page = await application.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await application
      .context()
      .tracing.start({ screenshots: true, snapshots: true, sources: true });
    this.running = { application, page, pid: application.process().pid ?? -1 };
    return page;
  }

  page(): Page {
    if (!this.running) throw new Error('Lecta is not running');
    return this.running.page;
  }

  currentPage(): Page | null {
    return this.running?.page ?? null;
  }

  async restart(): Promise<Page> {
    await this.close(false);
    return this.launch();
  }

  async close(preserveTrace: boolean, tracePath?: string): Promise<void> {
    const running = this.running;
    this.running = null;
    if (!running) return;
    if (preserveTrace && tracePath)
      await running.application.context().tracing.stop({ path: tracePath });
    else await running.application.context().tracing.stop();
    await running.application.close();
    await expect.poll(() => processExists(running.pid), { timeout: 5_000 }).toBe(false);
  }
}

type E2EFixtures = { lecta: LectaHarness; page: Page };
type E2EOptions = { e2eScenario: E2EScenario };

export const test = base.extend<E2EFixtures & E2EOptions>({
  e2eScenario: ['success', { option: true }],
  lecta: async ({ e2eScenario }, use, testInfo) => {
    const userDataPath = mkdtempSync(path.join(tmpdir(), 'lecta-e2e-'));
    const harness = new LectaHarness(userDataPath, e2eScenario);
    try {
      await use(harness);
    } finally {
      const failed = testInfo.status !== testInfo.expectedStatus;
      if (failed) {
        const screenshot = testInfo.outputPath('failure.png');
        const trace = testInfo.outputPath('trace.zip');
        const currentPage = harness.currentPage();
        if (currentPage && !currentPage.isClosed())
          await currentPage.screenshot({ path: screenshot, fullPage: true });
        await harness.close(true, trace);
        if (currentPage && existsSync(screenshot))
          await testInfo.attach('failure-screenshot', {
            path: screenshot,
            contentType: 'image/png',
          });
        if (existsSync(trace))
          await testInfo.attach('trace', {
            path: trace,
            contentType: 'application/zip',
          });
      } else await harness.close(false);
      rmSync(userDataPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
  page: async ({ lecta }, use) => {
    await use(await lecta.launch());
  },
});

export { expect };

function e2eEnvironment(userDataPath: string, scenario: E2EScenario): Record<string, string> {
  const environment: Record<string, string> = {
    LECTA_E2E: '1',
    LECTA_E2E_USER_DATA: userDataPath,
    LECTA_E2E_SCENARIO: scenario,
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
  };
  for (const name of [
    'PATH',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
    'LOCALAPPDATA',
    'APPDATA',
    'DISPLAY',
    'CI',
  ]) {
    const value = process.env[name];
    if (value !== undefined) environment[name] = value;
  }
  return environment;
}

function processExists(pid: number): boolean {
  if (pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
