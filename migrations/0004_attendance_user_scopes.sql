ALTER TABLE attendance_users ADD COLUMN scopes TEXT;

UPDATE attendance_users
SET scopes = '[{"course":"' || course || '","module":"' || COALESCE(module, '') || '"}]'
WHERE scopes IS NULL OR scopes = '';

