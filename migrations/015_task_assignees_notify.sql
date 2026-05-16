-- Add notify_user_ids to tasks (users who want to be notified on updates)
-- assignee_ids already exists; notify_user_ids is separate (watchers)

ALTER TABLE listflow.tasks
  ADD COLUMN IF NOT EXISTS notify_user_ids UUID[] DEFAULT '{}';

-- Index for notification lookups
CREATE INDEX IF NOT EXISTS tasks_notify_user_ids ON listflow.tasks USING GIN(notify_user_ids);
