-- Experimental D1 schema. Do not import production credentials or user data.
CREATE TABLE IF NOT EXISTS flow_credit_ledgers (
 user_id TEXT PRIMARY KEY NOT NULL,
 balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
 confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed >= 0),
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
 updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 data TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),
 updated_at TEXT NOT NULL,
 deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_user_updated ON projects(user_id, updated_at DESC);
