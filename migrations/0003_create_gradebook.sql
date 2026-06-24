CREATE TABLE IF NOT EXISTS gradebook (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  full_name TEXT,
  course TEXT,
  period TEXT,
  average REAL NOT NULL DEFAULT 0,
  status TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(enrollment_id, period)
);

CREATE INDEX IF NOT EXISTS idx_gradebook_enrollment ON gradebook(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_gradebook_period ON gradebook(period);
