-- Migration 016: add task_number (per-workspace sequential ID)
-- Short ID displayed as AAA### where AAA = workspace name initials

ALTER TABLE listflow.tasks
  ADD COLUMN IF NOT EXISTS task_number INTEGER;

-- Backfill existing tasks with sequential numbers per workspace
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY created_at) AS n
  FROM listflow.tasks
)
UPDATE listflow.tasks t SET task_number = n.n FROM numbered n WHERE t.id = n.id;

-- Function: auto-assign task_number on INSERT
CREATE OR REPLACE FUNCTION listflow.assign_task_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  SELECT COALESCE(MAX(task_number), 0) + 1
    INTO NEW.task_number
    FROM listflow.tasks
   WHERE workspace_id = NEW.workspace_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_task_number ON listflow.tasks;
CREATE TRIGGER trg_assign_task_number
  BEFORE INSERT ON listflow.tasks
  FOR EACH ROW WHEN (NEW.task_number IS NULL)
  EXECUTE FUNCTION listflow.assign_task_number();
