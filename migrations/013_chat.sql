-- ListFlow Chat Feature Migration
-- Creates chat_channels and chat_messages tables in the listflow schema

-- Chat channels (rooms) scoped to workspace
CREATE TABLE IF NOT EXISTS listflow.chat_channels (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES listflow.workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS listflow.chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   UUID NOT NULL REFERENCES listflow.chat_channels(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  user_id      UUID NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  file_url     TEXT,
  file_name    TEXT,
  file_type    TEXT,
  task_id      UUID REFERENCES listflow.tasks(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS chat_channels_workspace_idx ON listflow.chat_channels(workspace_id);
CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx ON listflow.chat_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_workspace_idx ON listflow.chat_messages(workspace_id);

-- RLS
ALTER TABLE listflow.chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE listflow.chat_messages  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_channels' AND policyname = 'service_all_channels'
  ) THEN
    CREATE POLICY "service_all_channels" ON listflow.chat_channels FOR ALL TO service_role USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'service_all_messages'
  ) THEN
    CREATE POLICY "service_all_messages" ON listflow.chat_messages FOR ALL TO service_role USING (true);
  END IF;
END $$;

-- Auto-update updated_at on messages
CREATE OR REPLACE FUNCTION listflow.update_chat_messages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_updated_at ON listflow.chat_messages;
CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON listflow.chat_messages
  FOR EACH ROW EXECUTE FUNCTION listflow.update_chat_messages_updated_at();
