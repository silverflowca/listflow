-- Add soft-delete and edit support to chat_messages

ALTER TABLE listflow.chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_for UUID[] DEFAULT '{}';

-- Index for efficient filtering of deleted messages
CREATE INDEX IF NOT EXISTS chat_messages_deleted_at ON listflow.chat_messages(deleted_at) WHERE deleted_at IS NOT NULL;
