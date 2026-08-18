CREATE TABLE IF NOT EXISTS transcription_jobs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  recording_path TEXT NOT NULL,
  model TEXT NOT NULL CHECK (model IN ('small', 'medium')),
  resource_mode TEXT NOT NULL CHECK (resource_mode IN ('LIGHT', 'NORMAL')),
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'PREPARING', 'TRANSCRIBING', 'SAVING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  language TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,
  start_time REAL NOT NULL CHECK (start_time >= 0),
  end_time REAL NOT NULL CHECK (end_time >= start_time),
  text TEXT NOT NULL,
  UNIQUE(transcript_id, segment_index)
);

CREATE INDEX IF NOT EXISTS transcript_segments_session_idx
ON transcript_segments(session_id, segment_index);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (2, CURRENT_TIMESTAMP);
