import { _electron as electron } from '@playwright/test';
import { fork } from 'node:child_process';
import { createRequire } from 'node:module';
import { cpus, freemem, hostname, platform, release, totalmem } from 'node:os';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { format } from 'prettier';
import { summarize, round } from './performance-utils.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(root, 'performance', 'results', 'latest.json');
const reportPath = join(root, 'docs', 'performance', 'PERFORMANCE.md');
const dataChild = join(root, 'scripts', 'performance-data-child.mjs');
const knowledgeChild = join(root, 'scripts', 'benchmark-knowledge-child.mjs');
const electronModule = createRequire(import.meta.url)('electron');
if (typeof electronModule !== 'string') throw new Error('Electron executable path is unavailable');
const electronVersion = createRequire(import.meta.url)('electron/package.json').version;

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const samplesPerKnowledgeSize = 5;
const freeMemoryAtStartBytes = freemem();

process.stdout.write('Measuring Electron startup and memory...\n');
const electronMetrics = await measureElectron(electronModule);
process.stdout.write('Measuring FTS fixtures...\n');
const fts = [];
for (const sessionCount of [1_000, 10_000]) {
  const result = await runChild(dataChild, ['fts', String(sessionCount)]);
  fts.push({
    dataset: { sessions: sessionCount },
    buildDurationMs: round(result.buildDurationMs),
    queryMs: summarize(result.queryLatenciesMs),
    memory: memoryResult(result.rssBytes),
  });
  process.stdout.write(`  FTS ${sessionCount} complete\n`);
}

process.stdout.write('Measuring knowledge worker fixtures...\n');
const knowledge = [];
for (const chunkCount of [1_000, 10_000, 100_000]) {
  const runs = [];
  for (let run = 0; run < samplesPerKnowledgeSize; run += 1)
    runs.push(await runKnowledge(chunkCount));
  knowledge.push({
    dataset: { chunks: chunkCount, dimensions: 64 },
    indexMs: summarize(runs.map((result) => result.indexDurationMs)),
    queryMs: summarize(runs.map((result) => result.queryLatencyMs)),
    coordinatorMaxLagMs: round(Math.max(...runs.map((result) => result.coordinatorMaxLagMs))),
    workerPeakMemory: memoryResult(Math.max(...runs.map((result) => result.workerPeakRssBytes))),
  });
  process.stdout.write(`  Knowledge ${chunkCount} complete\n`);
}

process.stdout.write('Measuring transcript fixture...\n');
const transcriptRaw = await runChild(dataChild, ['transcript', '10000']);
const transcript = {
  dataset: { segments: 10_000 },
  writeDurationMs: round(transcriptRaw.writeDurationMs),
  readMs: summarize(transcriptRaw.readLatenciesMs),
  memory: memoryResult(transcriptRaw.rssBytes),
};

const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'observational-baseline',
  environment: {
    hostname: hostname(),
    platform: platform(),
    osRelease: release(),
    architecture: process.arch,
    cpu: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    totalMemoryBytes: totalmem(),
    freeMemoryAtStartBytes,
    node: process.version,
    electron: electronVersion,
    lecta: packageJson.version,
    electronLaunchFlags: ['--disable-gpu'],
  },
  budgets: {
    homeInteractiveMs: 2_000,
    ftsP95Ms: 150,
    avoidableMainSynchronousTaskMs: 50,
    enforcement: false,
    note: 'Initial observations, not guarantees until target hardware is defined.',
  },
  metrics: { electron: electronMetrics, fts, knowledge, transcript },
};

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(outputPath, await format(JSON.stringify(result), { parser: 'json' }));
writeFileSync(reportPath, await format(renderReport(result), { parser: 'markdown' }));
process.stdout.write(`Baseline written to ${outputPath}\nReport written to ${reportPath}\n`);

async function measureElectron(executablePath) {
  const startupSamples = [];
  const idleMemorySamples = [];
  for (let run = 0; run < 5; run += 1) {
    const temporary = mkdtempSync(join(process.env.TEMP ?? process.env.TMP ?? root, 'lecta-perf-'));
    const started = performance.now();
    const application = await launchElectron(executablePath, temporary);
    try {
      const page = await application.firstWindow();
      await page.getByRole('heading', { name: 'Biblioteca', exact: true }).waitFor();
      startupSamples.push(performance.now() - started);
      idleMemorySamples.push(await totalElectronWorkingSet(application));
    } finally {
      await application.close();
      rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }

  const temporary = mkdtempSync(join(process.env.TEMP ?? process.env.TMP ?? root, 'lecta-perf-'));
  const application = await launchElectron(executablePath, temporary);
  const recordingMemorySamples = [];
  try {
    const page = await application.firstWindow();
    await page.getByRole('button', { name: 'Nueva sesión' }).click();
    const dialog = page.getByRole('dialog', { name: '¿Qué vas a registrar?' });
    await dialog.getByLabel('Título').fill('Fixture de rendimiento');
    await dialog.getByRole('button', { name: 'Crear sesión' }).click();
    await page.getByRole('button', { name: 'Grabar' }).click();
    await page.getByText('Grabando', { exact: true }).waitFor();
    for (let sample = 0; sample < 8; sample += 1) {
      recordingMemorySamples.push(await totalElectronWorkingSet(application));
      await page.waitForTimeout(500);
    }
    await page.getByRole('button', { name: 'Finalizar' }).click();
  } finally {
    await application.close();
    rmSync(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
  return {
    startupToHomeInteractiveMs: summarize(startupSamples),
    idleMemory: summarizeMemory(idleMemorySamples),
    recordingFixtureMemory: {
      ...summarizeMemory(recordingMemorySamples),
      growthBytes: Math.max(0, recordingMemorySamples.at(-1) - recordingMemorySamples[0]),
      sampleWindowSeconds: 4,
    },
  };
}

async function launchElectron(executablePath, userDataPath) {
  return electron.launch({
    executablePath,
    args: ['--disable-gpu', root],
    cwd: root,
    offline: true,
    timeout: 30_000,
    env: e2eEnvironment(userDataPath),
  });
}

function e2eEnvironment(userDataPath) {
  const environment = {
    LECTA_E2E: '1',
    LECTA_E2E_USER_DATA: userDataPath,
    LECTA_E2E_SCENARIO: 'success',
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
    'XAUTHORITY',
    'CI',
  ]) {
    if (process.env[name] !== undefined) environment[name] = process.env[name];
  }
  return environment;
}

async function totalElectronWorkingSet(application) {
  const metrics = await application.evaluate(({ app }) => app.getAppMetrics());
  return metrics.reduce((total, metric) => total + metric.memory.workingSetSize * 1024, 0);
}

async function runChild(entrypoint, argumentsList) {
  const directory = mkdtempSync(join(process.env.TEMP ?? process.env.TMP ?? root, 'lecta-perf-'));
  const databasePath = join(directory, 'fixture.sqlite');
  try {
    return await forkForResult(entrypoint, [...argumentsList, databasePath]);
  } finally {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

async function runKnowledge(chunkCount) {
  const directory = mkdtempSync(join(process.env.TEMP ?? process.env.TMP ?? root, 'lecta-perf-'));
  const databasePath = join(directory, 'knowledge.sqlite');
  let expected = performance.now() + 5;
  let maxLag = 0;
  const monitor = setInterval(() => {
    const now = performance.now();
    maxLag = Math.max(maxLag, now - expected);
    expected = now + 5;
  }, 5);
  try {
    const childResult = await forkForResult(knowledgeChild, [
      String(chunkCount),
      databasePath,
      '64',
    ]);
    return { ...childResult, coordinatorMaxLagMs: maxLag };
  } finally {
    clearInterval(monitor);
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function forkForResult(entrypoint, argumentsList) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = fork(entrypoint, argumentsList, {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      rejectPromise(new Error(`Performance fixture timed out: ${entrypoint}`));
    }, 300_000);
    child.once('message', (message) => {
      settled = true;
      clearTimeout(timeout);
      child.disconnect();
      child.kill();
      resolvePromise(message);
    });
    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });
    child.once('exit', (code) => {
      if (!settled && code && code !== 0) {
        clearTimeout(timeout);
        rejectPromise(new Error(`Performance fixture exited with code ${code}`));
      }
    });
  });
}

function memoryResult(bytes) {
  return { bytes, mebibytes: round(bytes / 1024 / 1024) };
}

function summarizeMemory(values) {
  const summary = summarize(values);
  return {
    samples: summary.samples,
    p50Bytes: summary.p50,
    p95Bytes: summary.p95,
    p50MiB: round(summary.p50 / 1024 / 1024),
    p95MiB: round(summary.p95 / 1024 / 1024),
  };
}

function renderReport(baseline) {
  const rows = baseline.metrics.fts.map(
    (item) =>
      `| FTS query | ${item.dataset.sessions.toLocaleString('en-US')} sessions | ${item.queryMs.p50} | ${item.queryMs.p95} | ${item.memory.mebibytes} MiB |`,
  );
  for (const item of baseline.metrics.knowledge)
    rows.push(
      `| Knowledge query | ${item.dataset.chunks.toLocaleString('en-US')} chunks | ${item.queryMs.p50} | ${item.queryMs.p95} | ${item.workerPeakMemory.mebibytes} MiB peak |`,
    );
  rows.push(
    `| Transcript read | 10,000 segments | ${baseline.metrics.transcript.readMs.p50} | ${baseline.metrics.transcript.readMs.p95} | ${baseline.metrics.transcript.memory.mebibytes} MiB |`,
  );
  return `# Lecta performance baseline

Generated: ${baseline.generatedAt}

This is an observational, reproducible baseline—not a product guarantee. It uses deterministic synthetic data, runs offline, and does not enable permanent production profiling. Run it with \`pnpm benchmark:performance\`; the command builds Lecta first and replaces \`performance/results/latest.json\` plus this report.

## Environment

- Host: ${baseline.environment.hostname}
- OS: ${baseline.environment.platform} ${baseline.environment.osRelease} (${baseline.environment.architecture})
- CPU: ${baseline.environment.cpu} (${baseline.environment.logicalCpuCount} logical CPUs)
- RAM: ${round(baseline.environment.totalMemoryBytes / 1024 / 1024 / 1024)} GiB
- Node: ${baseline.environment.node}
- Electron dependency: ${baseline.environment.electron}
- Lecta: ${baseline.environment.lecta}
- Benchmark Electron flags: ${baseline.environment.electronLaunchFlags.join(', ')} (software rendering for headless/automated reproducibility)

## Results

| Metric | Dataset | p50 ms | p95 ms | Memory |
| --- | ---: | ---: | ---: | ---: |
| Startup → Home interactive | 5 cold isolated launches | ${baseline.metrics.electron.startupToHomeInteractiveMs.p50} | ${baseline.metrics.electron.startupToHomeInteractiveMs.p95} | ${baseline.metrics.electron.idleMemory.p95MiB} MiB idle p95 |
${rows.join('\n')}

Recording fixture memory: p50 ${baseline.metrics.electron.recordingFixtureMemory.p50MiB} MiB, p95 ${baseline.metrics.electron.recordingFixtureMemory.p95MiB} MiB, growth ${round(baseline.metrics.electron.recordingFixtureMemory.growthBytes / 1024 / 1024)} MiB over ${baseline.metrics.electron.recordingFixtureMemory.sampleWindowSeconds} seconds.

Knowledge index p50/p95 and coordinator event-loop lag are recorded in the JSON. Transcript write time and FTS fixture build time are also recorded separately from query latency.

## Initial budgets

- Home interactive: < 2,000 ms on target hardware.
- FTS p95: < 150 ms.
- Avoid avoidable synchronous work in Electron main > 50 ms.
- Recording memory should remain bounded and stable.

These budgets are recorded but are **not enforced** yet. Small differences do not fail CI. Hardware target, warm-up policy and run-to-run stability must be defined before introducing regression thresholds.

## Method and limitations

- Every Electron launch uses a unique temporary \`userData\` directory and deterministic E2E adapters. No real microphone, loopback, Whisper, AI, internet, or personal data is used.
- RAM is the sum of Electron process working sets reported by Electron; the short recording fixture detects obvious growth but does not replace a multi-hour soak test.
- FTS uses SQLite FTS5 with Lecta's tokenizer and representative pagination queries.
- Knowledge reproduces the current exact-vector SQLite scan in an isolated child process at 1k/10k/100k chunks; it measures architecture before selecting another vector store.
- Transcript measures insertion and complete ordered hydration of 10k segments in an isolated fixture process.
- Results vary with antivirus, thermal state, storage, and concurrent applications. Use several baselines on defined target hardware before treating them as regression gates.
`;
}
