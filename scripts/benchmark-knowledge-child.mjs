import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';

const chunkCount = Number(process.argv[2]);
const databasePath = process.argv[3];
const dimension = Number(process.argv[4] ?? 64);

if (!Number.isInteger(chunkCount) || chunkCount < 1 || !databasePath || !process.send)
  throw new Error('Invalid benchmark configuration');

const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE benchmark_chunks (
    id INTEGER PRIMARY KEY,
    embedding BLOB NOT NULL,
    dimension INTEGER NOT NULL
  );
`);

let peakRss = process.memoryUsage().rss;
const indexStarted = performance.now();
database.exec('BEGIN IMMEDIATE');
const insert = database.prepare(
  'INSERT INTO benchmark_chunks (id, embedding, dimension) VALUES (?, ?, ?)',
);
for (let index = 0; index < chunkCount; index += 1) {
  const vector = createVector(index, dimension);
  insert.run(index, new Uint8Array(vector.buffer), dimension);
  if (index % 1_000 === 0) peakRss = Math.max(peakRss, process.memoryUsage().rss);
}
database.exec('COMMIT');
const indexDurationMs = performance.now() - indexStarted;
peakRss = Math.max(peakRss, process.memoryUsage().rss);

const query = createVector(17, dimension);
const queryStarted = performance.now();
const rows = database
  .prepare('SELECT embedding, dimension FROM benchmark_chunks WHERE dimension = ?')
  .all(dimension);
const scores = rows.map((row) => cosine(query, fromBlob(row.embedding, Number(row.dimension))));
scores.sort((left, right) => right - left);
const queryLatencyMs = performance.now() - queryStarted;
peakRss = Math.max(peakRss, process.memoryUsage().rss);

database.close();
process.send({
  chunkCount,
  dimension,
  indexDurationMs,
  queryLatencyMs,
  workerPeakRssBytes: peakRss,
  bestScore: scores[0] ?? 0,
});

function createVector(seed, length) {
  const vector = new Float32Array(length);
  let state = (seed + 1) >>> 0;
  let norm = 0;
  for (let index = 0; index < length; index += 1) {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    const value = state / 0xffffffff - 0.5;
    vector[index] = value;
    norm += value * value;
  }
  const scale = Math.sqrt(norm) || 1;
  for (let index = 0; index < length; index += 1) vector[index] /= scale;
  return vector;
}

function fromBlob(blob, length) {
  const copy = new Uint8Array(blob).slice();
  return new Float32Array(copy.buffer, copy.byteOffset, length);
}

function cosine(left, right) {
  let dot = 0;
  for (let index = 0; index < left.length; index += 1)
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  return dot;
}
