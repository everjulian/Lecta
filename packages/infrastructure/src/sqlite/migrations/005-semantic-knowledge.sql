CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  text TEXT NOT NULL,
  embedding BLOB NOT NULL,
  dimension INTEGER NOT NULL,
  model TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS knowledge_chunks_session_idx ON knowledge_chunks(session_id);
CREATE INDEX IF NOT EXISTS knowledge_chunks_model_idx ON knowledge_chunks(model);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (5, CURRENT_TIMESTAMP);
