import { DatabaseSync } from 'node:sqlite';
import { performance } from 'node:perf_hooks';
import { syntheticSentence } from './performance-utils.mjs';

const mode = process.argv[2];
const size = Number(process.argv[3]);
const databasePath = process.argv[4];

if (!process.send || !databasePath || !Number.isInteger(size) || size < 1)
  throw new Error('Invalid performance fixture configuration');

const database = new DatabaseSync(databasePath);
database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

let result;
try {
  if (mode === 'fts') result = runFts(size);
  else if (mode === 'transcript') result = runTranscript(size);
  else throw new Error(`Unknown performance fixture: ${mode}`);
} finally {
  database.close();
}
process.send(result);

function runFts(sessionCount) {
  database.exec(`
    CREATE TABLE sessions (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL,
      subject TEXT, status TEXT NOT NULL, duration_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE VIRTUAL TABLE session_search USING fts5(
      session_id UNINDEXED, source UNINDEXED, content,
      tokenize = 'unicode61 remove_diacritics 2');
  `);
  const insertSession = database.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSearch = database.prepare('INSERT INTO session_search VALUES (?, ?, ?)');
  const buildStarted = performance.now();
  database.exec('BEGIN IMMEDIATE');
  for (let index = 0; index < sessionCount; index += 1) {
    const id = `session-${index.toString().padStart(6, '0')}`;
    const createdAt = new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString();
    insertSession.run(
      id,
      `Sesión sintética ${index}`,
      index % 2 === 0 ? 'CLASS' : 'MEETING',
      `Materia ${index % 20}`,
      'COMPLETED',
      index * 1_000,
      createdAt,
      createdAt,
    );
    insertSearch.run(id, 'transcript', syntheticSentence(index));
  }
  database.exec('COMMIT');
  const buildDurationMs = performance.now() - buildStarted;
  const search = database.prepare(`
    SELECT s.id FROM sessions s
    WHERE EXISTS (
      SELECT 1 FROM session_search f
      WHERE f.session_id = s.id AND session_search MATCH ?
    )
    ORDER BY s.created_at DESC LIMIT 12 OFFSET ?
  `);
  const terms = ['arquitectura', 'persistencia', 'electron', 'audio', 'conocimiento'];
  const queryLatenciesMs = [];
  for (let index = 0; index < 10; index += 1) {
    const started = performance.now();
    search.all(terms[index % terms.length], (index % 5) * 12);
    queryLatenciesMs.push(performance.now() - started);
  }
  return {
    sessionCount,
    buildDurationMs,
    queryLatenciesMs,
    rssBytes: process.memoryUsage().rss,
  };
}

function runTranscript(segmentCount) {
  database.exec(`
    CREATE TABLE transcript_segments (
      id TEXT PRIMARY KEY, transcript_id TEXT NOT NULL, session_id TEXT NOT NULL,
      segment_index INTEGER NOT NULL, start_time REAL NOT NULL,
      end_time REAL NOT NULL, text TEXT NOT NULL,
      UNIQUE(transcript_id, segment_index));
    CREATE INDEX transcript_segments_session_idx
      ON transcript_segments(session_id, segment_index);
  `);
  const insert = database.prepare('INSERT INTO transcript_segments VALUES (?, ?, ?, ?, ?, ?, ?)');
  const writeStarted = performance.now();
  database.exec('BEGIN IMMEDIATE');
  for (let index = 0; index < segmentCount; index += 1) {
    insert.run(
      `segment-${index}`,
      'transcript-fixture',
      'session-fixture',
      index,
      index * 4,
      index * 4 + 4,
      syntheticSentence(index),
    );
  }
  database.exec('COMMIT');
  const writeDurationMs = performance.now() - writeStarted;
  const read = database.prepare(`
    SELECT id, session_id, start_time, end_time, text
    FROM transcript_segments WHERE session_id = ? ORDER BY segment_index
  `);
  const readLatenciesMs = [];
  for (let run = 0; run < 10; run += 1) {
    const started = performance.now();
    const rows = read.all('session-fixture');
    rows.map((row) => ({ ...row }));
    readLatenciesMs.push(performance.now() - started);
  }
  return {
    segmentCount,
    writeDurationMs,
    readLatenciesMs,
    rssBytes: process.memoryUsage().rss,
  };
}
