-- Add effort_points to tasks table
-- Stores estimated/actual effort as a free-text value (e.g. "3h", "2 days", "5 pts")
ALTER TABLE listflow.tasks
  ADD COLUMN IF NOT EXISTS effort_points TEXT DEFAULT NULL;
