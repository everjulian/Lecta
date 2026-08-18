import { fork } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sizes = [1_000, 10_000, 100_000];
const dimension = 64;
const childEntrypoint = fileURLToPath(new URL('./benchmark-knowledge-child.mjs', import.meta.url));
const results = [];

for (const size of sizes) results.push(await run(size));

process.stdout.write(
  [
    `Synthetic exact-vector benchmark (${dimension} dimensions)`,
    '| chunks | index ms | query ms | coordinator max lag ms | worker peak RSS MB | coordinator RSS MB |',
    '| ---: | ---: | ---: | ---: | ---: | ---: |',
    ...results.map(
      (result) =>
        `| ${result.chunkCount} | ${result.indexDurationMs.toFixed(1)} | ${result.queryLatencyMs.toFixed(1)} | ${result.coordinatorMaxLagMs.toFixed(1)} | ${toMb(result.workerPeakRssBytes)} | ${toMb(result.coordinatorRssBytes)} |`,
    ),
    '',
  ].join('\n'),
);

async function run(chunkCount) {
  const directory = mkdtempSync(join(tmpdir(), `lecta-knowledge-${chunkCount}-`));
  const databasePath = join(directory, 'benchmark.sqlite');
  const intervalMs = 5;
  let expected = performance.now() + intervalMs;
  let maxLag = 0;
  const monitor = setInterval(() => {
    const now = performance.now();
    maxLag = Math.max(maxLag, now - expected);
    expected = now + intervalMs;
  }, intervalMs);
  try {
    const result = await new Promise((resolve, reject) => {
      const child = fork(childEntrypoint, [String(chunkCount), databasePath, String(dimension)], {
        stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      });
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error(`Benchmark timed out for ${chunkCount} chunks`));
      }, 180_000);
      child.once('message', (message) => {
        clearTimeout(timeout);
        resolve(message);
      });
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code) => {
        if (code && code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Benchmark child exited with code ${code}`));
        }
      });
    });
    return {
      ...result,
      coordinatorMaxLagMs: maxLag,
      coordinatorRssBytes: process.memoryUsage().rss,
    };
  } finally {
    clearInterval(monitor);
    rmSync(directory, { recursive: true, force: true });
  }
}

function toMb(bytes) {
  return (bytes / 1024 / 1024).toFixed(1);
}
