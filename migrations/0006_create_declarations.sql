-- Local, reviewable migration. No institutional rules or completion approvals are seeded.
CREATE TABLE IF NOT EXISTS declaration_course_policies (
  id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  version TEXT NOT NULL,
  required_modules TEXT NOT NULL,
  required_hours REAL NOT NULL CHECK(required_hours > 0),
  min_attendance REAL NOT NULL CHECK(min_attendance BETWEEN 0 AND 100),
  min_grade REAL NOT NULL CHECK(min_grade BETWEEN 0 AND 10),
  additional_requirements TEXT NOT NULL DEFAULT '[]',
  institutional_reference TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  UNIQUE(course, version)
);

CREATE TABLE IF NOT EXISTS declaration_completion_validations (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL,
  course TEXT NOT NULL,
  policy_id TEXT NOT NULL REFERENCES declaration_course_policies(id),
  evidence_json TEXT NOT NULL,
  secretary_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(secretary_confirmed IN (0,1)),
  validated_by_name TEXT NOT NULL,
  validated_by_account TEXT NOT NULL,
  validated_at TEXT NOT NULL,
  course_completed_at TEXT NOT NULL,
  certificate_status TEXT NOT NULL CHECK(certificate_status IN ('pending','issued'))
);
CREATE INDEX IF NOT EXISTS idx_declaration_validations_enrollment
ON declaration_completion_validations(enrollment_id, validated_at DESC);

CREATE TABLE IF NOT EXISTS declarations_issued (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  control_number TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('studies','completion')),
  enrollment_id TEXT NOT NULL,
  student_name TEXT NOT NULL,
  course TEXT NOT NULL,
  period TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  issuer_account TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  validation_id TEXT REFERENCES declaration_completion_validations(id),
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_declarations_issued_date ON declarations_issued(issued_at DESC);

-- Preserve the issued snapshot: reprinting never changes the original emission.
CREATE TRIGGER IF NOT EXISTS declarations_issued_immutable_update
BEFORE UPDATE ON declarations_issued BEGIN SELECT RAISE(ABORT, 'Issued declarations are immutable'); END;
CREATE TRIGGER IF NOT EXISTS declarations_issued_immutable_delete
BEFORE DELETE ON declarations_issued BEGIN SELECT RAISE(ABORT, 'Issued declarations are immutable'); END;
