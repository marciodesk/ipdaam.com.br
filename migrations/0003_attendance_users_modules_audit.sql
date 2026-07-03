CREATE TABLE IF NOT EXISTS attendance_users (
  id TEXT PRIMARY KEY,
  login TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'professor',
  course TEXT NOT NULL,
  module TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE attendance RENAME TO attendance_old;

CREATE TABLE attendance (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  cpf TEXT,
  full_name TEXT,
  course TEXT,
  module TEXT NOT NULL DEFAULT '',
  class_date TEXT NOT NULL,
  status TEXT NOT NULL,
  justification TEXT,
  method TEXT,
  recorded_by TEXT,
  recorded_by_name TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(enrollment_id, class_date, module)
);

INSERT INTO attendance (
  id, enrollment_id, cpf, full_name, course, module, class_date, status,
  justification, method, payload, created_at, updated_at
)
SELECT id, enrollment_id, cpf, full_name, course, '', class_date, status,
  justification, method, payload, created_at, updated_at
FROM attendance_old;

DROP TABLE attendance_old;

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(class_date);
CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(course);
CREATE INDEX IF NOT EXISTS idx_attendance_cpf ON attendance(cpf);
CREATE INDEX IF NOT EXISTS idx_attendance_module ON attendance(module);

CREATE TABLE IF NOT EXISTS attendance_audit (
  id TEXT PRIMARY KEY,
  attendance_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_by TEXT,
  changed_by_name TEXT,
  previous_payload TEXT,
  new_payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_record ON attendance_audit(attendance_id);
