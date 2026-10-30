-- Local experimental identities only; no passwords, sessions or data imported from production.
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 salt TEXT NOT NULL,
 iterations INTEGER NOT NULL CHECK(iterations >= 100000),
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(user_id,id);
