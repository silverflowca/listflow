-- ============================================================
-- ListFlow — Complete Cloud Migration
-- Run once against Supabase Cloud SQL Editor (or psql)
-- Combines: 20260424000002_listflow_schema.sql
--         + 20260430000001_listflow_users_groups.sql
-- ============================================================

BEGIN;

-- ── Schema bootstrap ──────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS listflow;
GRANT USAGE ON SCHEMA listflow TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA listflow GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA listflow GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA listflow GRANT SELECT ON TABLES TO authenticated;

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE listflow.workspace_type AS ENUM ('personal', 'group');       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listflow.member_role    AS ENUM ('owner', 'admin', 'member', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listflow.block_type     AS ENUM ('text','h1','h2','h3','todo','bullet','numbered','code','divider','image','audio','embed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listflow.task_status    AS ENUM ('todo','in_progress','review','done','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listflow.task_priority  AS ENUM ('low','medium','high','urgent');  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listflow.agent_status   AS ENUM ('running','done','failed');       EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listflow.app_role       AS ENUM ('admin', 'manager', 'member', 'viewer', 'guest'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE listflow.user_status    AS ENUM ('active', 'invited', 'inactive', 'suspended');    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Core tables ───────────────────────────────────────────────────────────────

-- 1. App settings (API keys stored via UI)
CREATE TABLE IF NOT EXISTS listflow.app_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Workspaces
CREATE TABLE IF NOT EXISTS listflow.workspaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        listflow.workspace_type NOT NULL DEFAULT 'personal',
  owner_id    UUID NOT NULL,
  icon        TEXT,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Workspace members
CREATE TABLE IF NOT EXISTS listflow.workspace_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  role         listflow.member_role NOT NULL DEFAULT 'member',
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

-- 4. Pages
CREATE TABLE IF NOT EXISTS listflow.pages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES listflow.pages(id) ON DELETE SET NULL,
  title        TEXT NOT NULL DEFAULT 'Untitled',
  icon         TEXT,
  cover_url    TEXT,
  is_database  BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID NOT NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Blocks
CREATE TABLE IF NOT EXISTS listflow.blocks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id         UUID NOT NULL REFERENCES listflow.pages(id) ON DELETE CASCADE,
  parent_block_id UUID REFERENCES listflow.blocks(id) ON DELETE CASCADE,
  type            listflow.block_type NOT NULL DEFAULT 'text',
  content         JSONB NOT NULL DEFAULT '{}',
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Databases (linked to a page)
CREATE TABLE IF NOT EXISTS listflow.databases (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id    UUID NOT NULL REFERENCES listflow.pages(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Database',
  schema_def JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Entries (rows in a database)
CREATE TABLE IF NOT EXISTS listflow.entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_id  UUID NOT NULL REFERENCES listflow.databases(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  properties   JSONB NOT NULL DEFAULT '{}',
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tasks
CREATE TABLE IF NOT EXISTS listflow.tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  database_id    UUID REFERENCES listflow.databases(id) ON DELETE SET NULL,
  title          TEXT NOT NULL,
  description    TEXT,
  status         listflow.task_status NOT NULL DEFAULT 'todo',
  priority       listflow.task_priority NOT NULL DEFAULT 'medium',
  assignee_ids   TEXT[] NOT NULL DEFAULT '{}',
  parent_task_id UUID REFERENCES listflow.tasks(id) ON DELETE SET NULL,
  due_date       DATE,
  labels         TEXT[] NOT NULL DEFAULT '{}',
  created_by     UUID NOT NULL,
  position       INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Subtasks
CREATE TABLE IF NOT EXISTS listflow.subtasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES listflow.tasks(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  completed  BOOLEAN NOT NULL DEFAULT false,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Comments
CREATE TABLE IF NOT EXISTS listflow.comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES listflow.tasks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Audio recordings
CREATE TABLE IF NOT EXISTS listflow.audio_recordings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  page_id      UUID REFERENCES listflow.pages(id) ON DELETE SET NULL,
  task_id      UUID REFERENCES listflow.tasks(id) ON DELETE SET NULL,
  filename     TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  duration_ms  INTEGER,
  size_bytes   INTEGER,
  mime_type    TEXT NOT NULL DEFAULT 'audio/webm',
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. Transcripts
CREATE TABLE IF NOT EXISTS listflow.transcripts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id     UUID NOT NULL REFERENCES listflow.audio_recordings(id) ON DELETE CASCADE,
  workspace_id     UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  raw_text         TEXT NOT NULL,
  confidence_score FLOAT,
  words            JSONB NOT NULL DEFAULT '[]',
  language         TEXT NOT NULL DEFAULT 'en',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Agent runs
CREATE TABLE IF NOT EXISTS listflow.agent_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES listflow.transcripts(id) ON DELETE SET NULL,
  prompt        TEXT NOT NULL,
  response      TEXT,
  tool_calls    JSONB NOT NULL DEFAULT '[]',
  tasks_created TEXT[] NOT NULL DEFAULT '{}',
  iterations    INTEGER NOT NULL DEFAULT 0,
  total_tokens  INTEGER NOT NULL DEFAULT 0,
  status        listflow.agent_status NOT NULL DEFAULT 'running',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- 14. Agent memory
CREATE TABLE IF NOT EXISTS listflow.agent_memory (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, key)
);

-- ── User management tables ────────────────────────────────────────────────────

-- 15. App users (mirrors auth.users, adds profile + app-level role)
CREATE TABLE IF NOT EXISTS listflow.app_users (
  id            UUID PRIMARY KEY,                      -- same as auth.users.id
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL DEFAULT '',
  avatar_url    TEXT,
  initials      TEXT GENERATED ALWAYS AS (
    UPPER(LEFT(REGEXP_REPLACE(name, '\s+.*', ''), 1) ||
          COALESCE(LEFT(REGEXP_REPLACE(name, '^[^\s]+\s+', ''), 1), ''))
  ) STORED,
  color         TEXT NOT NULL DEFAULT '#5e3aa0',
  role          listflow.app_role NOT NULL DEFAULT 'member',
  status        listflow.user_status NOT NULL DEFAULT 'active',
  last_seen_at  TIMESTAMPTZ,
  invited_by    UUID REFERENCES listflow.app_users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. User groups
CREATE TABLE IF NOT EXISTS listflow.user_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#1e5799',
  icon        TEXT DEFAULT '👥',
  created_by  UUID NOT NULL REFERENCES listflow.app_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. Group membership
CREATE TABLE IF NOT EXISTS listflow.group_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES listflow.user_groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES listflow.app_users(id)   ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',          -- 'lead' | 'member'
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- 18. Config matrix (feature flags per role)
CREATE TABLE IF NOT EXISTS listflow.config_matrix (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature     TEXT NOT NULL,
  role        listflow.app_role NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  updated_by  UUID REFERENCES listflow.app_users(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feature, role)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lf_workspaces_owner      ON listflow.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_lf_members_workspace     ON listflow.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lf_members_user          ON listflow.workspace_members(user_id);

CREATE INDEX IF NOT EXISTS idx_lf_pages_workspace       ON listflow.pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lf_pages_parent          ON listflow.pages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lf_pages_position        ON listflow.pages(workspace_id, position);

CREATE INDEX IF NOT EXISTS idx_lf_blocks_page           ON listflow.blocks(page_id);
CREATE INDEX IF NOT EXISTS idx_lf_blocks_parent         ON listflow.blocks(parent_block_id) WHERE parent_block_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lf_blocks_position       ON listflow.blocks(page_id, position);

CREATE INDEX IF NOT EXISTS idx_lf_databases_page        ON listflow.databases(page_id);
CREATE INDEX IF NOT EXISTS idx_lf_entries_database      ON listflow.entries(database_id);
CREATE INDEX IF NOT EXISTS idx_lf_entries_workspace     ON listflow.entries(workspace_id);

CREATE INDEX IF NOT EXISTS idx_lf_tasks_workspace       ON listflow.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lf_tasks_status          ON listflow.tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_lf_tasks_priority        ON listflow.tasks(workspace_id, priority);
CREATE INDEX IF NOT EXISTS idx_lf_tasks_parent          ON listflow.tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lf_tasks_due             ON listflow.tasks(due_date) WHERE due_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lf_subtasks_task         ON listflow.subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_lf_comments_task         ON listflow.comments(task_id);

CREATE INDEX IF NOT EXISTS idx_lf_audio_workspace       ON listflow.audio_recordings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lf_audio_page            ON listflow.audio_recordings(page_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lf_audio_task            ON listflow.audio_recordings(task_id) WHERE task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lf_transcripts_workspace ON listflow.transcripts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lf_transcripts_recording ON listflow.transcripts(recording_id);

CREATE INDEX IF NOT EXISTS idx_lf_agent_runs_workspace  ON listflow.agent_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_lf_agent_runs_transcript ON listflow.agent_runs(transcript_id) WHERE transcript_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lf_agent_memory_ws_key   ON listflow.agent_memory(workspace_id, key);

CREATE INDEX IF NOT EXISTS idx_lf_app_users_email       ON listflow.app_users(email);
CREATE INDEX IF NOT EXISTS idx_lf_app_users_role        ON listflow.app_users(role);
CREATE INDEX IF NOT EXISTS idx_lf_app_users_status      ON listflow.app_users(status);
CREATE INDEX IF NOT EXISTS idx_lf_group_members_grp     ON listflow.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_lf_group_members_usr     ON listflow.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_lf_config_feature        ON listflow.config_matrix(feature);
CREATE INDEX IF NOT EXISTS idx_lf_config_role           ON listflow.config_matrix(role);

-- ── updated_at trigger function ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION listflow.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspaces','pages','blocks','entries','tasks','comments','agent_runs',
    'app_users','user_groups'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON listflow.%I; ' ||
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON listflow.%I FOR EACH ROW EXECUTE FUNCTION listflow.set_updated_at()',
      t, t
    );
  END LOOP;
END; $$;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE listflow.app_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.workspaces          ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.workspace_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.pages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.blocks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.databases           ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.entries             ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.tasks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.subtasks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.audio_recordings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.transcripts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.agent_runs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.agent_memory        ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.app_users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.user_groups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.group_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.config_matrix       ENABLE ROW LEVEL SECURITY;

-- Service role: unrestricted (used by server — never touches RLS)
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_settings','workspaces','workspace_members','pages','blocks','databases',
    'entries','tasks','subtasks','comments','audio_recordings','transcripts',
    'agent_runs','agent_memory','app_users','user_groups','group_members','config_matrix'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS service_all ON listflow.%I; ' ||
      'CREATE POLICY service_all ON listflow.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END; $$;

-- Workspace membership helper (SECURITY DEFINER avoids RLS recursion)
CREATE OR REPLACE FUNCTION listflow.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM listflow.workspaces    WHERE id = ws_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM listflow.workspace_members WHERE workspace_id = ws_id AND user_id = auth.uid()
  )
$$;

-- Authenticated user policies (workspace-scoped)
CREATE POLICY "auth_select" ON listflow.workspaces        FOR SELECT TO authenticated USING (listflow.is_workspace_member(id));
CREATE POLICY "auth_insert" ON listflow.workspaces        FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "auth_update" ON listflow.workspaces        FOR UPDATE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "auth_select" ON listflow.workspace_members FOR SELECT TO authenticated USING (listflow.is_workspace_member(workspace_id));

CREATE POLICY "auth_select" ON listflow.pages             FOR SELECT TO authenticated USING (listflow.is_workspace_member(workspace_id));
CREATE POLICY "auth_insert" ON listflow.pages             FOR INSERT TO authenticated WITH CHECK (listflow.is_workspace_member(workspace_id));
CREATE POLICY "auth_update" ON listflow.pages             FOR UPDATE TO authenticated USING (listflow.is_workspace_member(workspace_id));
CREATE POLICY "auth_delete" ON listflow.pages             FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "auth_select" ON listflow.blocks            FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM listflow.pages p WHERE p.id = page_id AND listflow.is_workspace_member(p.workspace_id)));
CREATE POLICY "auth_insert" ON listflow.blocks            FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM listflow.pages p WHERE p.id = page_id AND listflow.is_workspace_member(p.workspace_id)));
CREATE POLICY "auth_update" ON listflow.blocks            FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM listflow.pages p WHERE p.id = page_id AND listflow.is_workspace_member(p.workspace_id)));
CREATE POLICY "auth_delete" ON listflow.blocks            FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM listflow.pages p WHERE p.id = page_id AND listflow.is_workspace_member(p.workspace_id)));

CREATE POLICY "auth_select" ON listflow.tasks             FOR SELECT TO authenticated USING (listflow.is_workspace_member(workspace_id));
CREATE POLICY "auth_insert" ON listflow.tasks             FOR INSERT TO authenticated WITH CHECK (listflow.is_workspace_member(workspace_id));
CREATE POLICY "auth_update" ON listflow.tasks             FOR UPDATE TO authenticated USING (listflow.is_workspace_member(workspace_id));
CREATE POLICY "auth_delete" ON listflow.tasks             FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "auth_select" ON listflow.subtasks          FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM listflow.tasks t WHERE t.id = task_id AND listflow.is_workspace_member(t.workspace_id)));
CREATE POLICY "auth_select" ON listflow.comments          FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM listflow.tasks t WHERE t.id = task_id AND listflow.is_workspace_member(t.workspace_id)));
CREATE POLICY "auth_select" ON listflow.audio_recordings  FOR SELECT TO authenticated USING (listflow.is_workspace_member(workspace_id));
CREATE POLICY "auth_select" ON listflow.transcripts       FOR SELECT TO authenticated USING (listflow.is_workspace_member(workspace_id));
CREATE POLICY "auth_select" ON listflow.agent_runs        FOR SELECT TO authenticated USING (listflow.is_workspace_member(workspace_id));

-- App users / groups / config: all authenticated can read
CREATE POLICY "auth_read"   ON listflow.app_users         FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read"   ON listflow.user_groups       FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read"   ON listflow.group_members     FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read"   ON listflow.config_matrix     FOR SELECT TO authenticated USING (true);

-- ── Seed: default config matrix ───────────────────────────────────────────────

INSERT INTO listflow.config_matrix (feature, role, enabled) VALUES
  ('tasks_view',    'admin',   true),
  ('tasks_view',    'manager', true),
  ('tasks_view',    'member',  true),
  ('tasks_view',    'viewer',  true),
  ('tasks_view',    'guest',   false),
  ('tasks_edit',    'admin',   true),
  ('tasks_edit',    'manager', true),
  ('tasks_edit',    'member',  true),
  ('tasks_edit',    'viewer',  false),
  ('tasks_edit',    'guest',   false),
  ('pages_view',    'admin',   true),
  ('pages_view',    'manager', true),
  ('pages_view',    'member',  true),
  ('pages_view',    'viewer',  true),
  ('pages_view',    'guest',   false),
  ('pages_edit',    'admin',   true),
  ('pages_edit',    'manager', true),
  ('pages_edit',    'member',  true),
  ('pages_edit',    'viewer',  false),
  ('pages_edit',    'guest',   false),
  ('audio_view',    'admin',   true),
  ('audio_view',    'manager', true),
  ('audio_view',    'member',  true),
  ('audio_view',    'viewer',  true),
  ('audio_view',    'guest',   false),
  ('audio_record',  'admin',   true),
  ('audio_record',  'manager', true),
  ('audio_record',  'member',  true),
  ('audio_record',  'viewer',  false),
  ('audio_record',  'guest',   false),
  ('settings',      'admin',   true),
  ('settings',      'manager', false),
  ('settings',      'member',  false),
  ('settings',      'viewer',  false),
  ('settings',      'guest',   false),
  ('users_manage',  'admin',   true),
  ('users_manage',  'manager', false),
  ('users_manage',  'member',  false),
  ('users_manage',  'viewer',  false),
  ('users_manage',  'guest',   false),
  ('groups_manage', 'admin',   true),
  ('groups_manage', 'manager', true),
  ('groups_manage', 'member',  false),
  ('groups_manage', 'viewer',  false),
  ('groups_manage', 'guest',   false)
ON CONFLICT (feature, role) DO NOTHING;

-- ── Supabase Storage bucket for audio ────────────────────────────────────────
-- Run this in the Supabase Dashboard → Storage → New bucket
-- OR uncomment and run if storage schema is accessible:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('listflow-audio', 'listflow-audio', false, 52428800, ARRAY['audio/webm','audio/mp4','audio/mpeg','audio/ogg','audio/wav'])
-- ON CONFLICT (id) DO NOTHING;

COMMIT;
