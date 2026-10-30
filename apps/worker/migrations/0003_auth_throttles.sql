-- Hashed login bucket, no raw IP/email retained.
CREATE TABLE IF NOT EXISTS auth_throttles(
 key TEXT PRIMARY KEY NOT NULL,
 attempts INTEGER NOT NULL CHECK(attempts >= 0),
 reset_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_throttles_reset ON auth_throttles(reset_at);
