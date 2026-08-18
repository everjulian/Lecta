CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('CLASS', 'MEETING', 'OTHER')),
  subject TEXT,
  status TEXT NOT NULL CHECK (status IN ('IDLE', 'RECORDING', 'PAUSED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions(created_at DESC);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (1, CURRENT_TIMESTAMP);
