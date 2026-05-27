CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  cpf TEXT,
  full_name TEXT,
  course TEXT,
  class_date TEXT NOT NULL,
  status TEXT NOT NULL,
  justification TEXT,
  method TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(enrollment_id, class_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(class_date);
CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(course);
CREATE INDEX IF NOT EXISTS idx_attendance_cpf ON attendance(cpf);
