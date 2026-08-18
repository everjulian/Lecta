CREATE TABLE IF NOT EXISTS structured_notes (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE RESTRICT,
  summary TEXT NOT NULL,
  topics_json TEXT NOT NULL,
  key_concepts_json TEXT NOT NULL,
  tasks_json TEXT NOT NULL,
  study_questions_json TEXT NOT NULL,
  important_moments_json TEXT NOT NULL,
  exam_mentions_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (3, CURRENT_TIMESTAMP);
