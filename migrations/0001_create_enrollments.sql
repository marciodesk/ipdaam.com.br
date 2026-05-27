CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '',
  cpf TEXT NOT NULL DEFAULT '',
  course TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  enrollment_date TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_enrollments_updated_at
ON enrollments(updated_at);

CREATE INDEX IF NOT EXISTS idx_enrollments_status
ON enrollments(status);
