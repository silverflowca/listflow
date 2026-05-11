-- Add parent_id to workspaces to support folder/subfolder hierarchy
ALTER TABLE listflow.workspaces
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES listflow.workspaces(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lf_workspaces_parent ON listflow.workspaces(parent_id) WHERE parent_id IS NOT NULL;
