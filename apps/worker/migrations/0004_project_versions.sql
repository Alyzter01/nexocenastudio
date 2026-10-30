-- Experiment-only project revision journal; no production data.
CREATE TABLE IF NOT EXISTS project_versions (
 id TEXT PRIMARY KEY NOT NULL,
 project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>0),
 name TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('draft','in_progress','completed')),
 event TEXT NOT NULL CHECK(event IN ('created','updated')),
 created_at TEXT NOT NULL,
 UNIQUE(project_id,revision)
);
CREATE INDEX IF NOT EXISTS idx_project_versions_user_time ON project_versions(user_id,created_at DESC);
