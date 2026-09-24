CREATE INDEX IF NOT EXISTS idx_attendance_page
ON attendance(class_date, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_risk
ON attendance(course, module, enrollment_id) WHERE status = 'Falta';
