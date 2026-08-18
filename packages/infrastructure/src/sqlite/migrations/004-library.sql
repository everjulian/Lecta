CREATE TABLE IF NOT EXISTS session_tags (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tag TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY (session_id, tag)
);

CREATE INDEX IF NOT EXISTS sessions_type_created_idx ON sessions(type, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_subject_created_idx ON sessions(subject COLLATE NOCASE, created_at DESC);
CREATE INDEX IF NOT EXISTS session_tags_tag_idx ON session_tags(tag COLLATE NOCASE, session_id);

CREATE VIRTUAL TABLE IF NOT EXISTS session_search USING fts5(
  session_id UNINDEXED,
  source UNINDEXED,
  content,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS library_index_state (
  version INTEGER PRIMARY KEY,
  indexed_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_migrations(version, applied_at)
VALUES (4, CURRENT_TIMESTAMP);
