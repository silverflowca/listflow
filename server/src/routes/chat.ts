import { Hono } from 'hono'
import { lf, supabase } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { emitChatMessage, emitChatMessageUpdated, emitChatMessageDeleted, emitChatTyping, emitTaskCreated } from '../lib/ws.js'
import { randomUUID } from 'crypto'

const r = new Hono()

// ── GET /api/chat/channels?workspaceId= ──────────────────────────────────────
// List channels for a workspace. Auto-creates "General" if none exist.

r.get('/channels', requireAuth, async (c) => {
  const user = c.get('user')
  const workspaceId = c.req.query('workspaceId')
  if (!workspaceId) return c.json({ error: 'workspaceId required' }, 400)

  let { data: channels, error } = await (lf('chat_channels') as any)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)

  // Auto-seed General channel
  if (!channels || channels.length === 0) {
    const { data: seeded, error: seedErr } = await (lf('chat_channels') as any)
      .insert({ workspace_id: workspaceId, name: 'General', description: 'General discussion', created_by: user.id })
      .select()
    if (seedErr) return c.json({ error: seedErr.message }, 500)
    channels = seeded ?? []
  }

  return c.json({ channels })
})

// ── POST /api/chat/channels ──────────────────────────────────────────────────
// Create a new channel

r.post('/channels', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json() as { workspaceId: string; name: string; description?: string }
  if (!body.workspaceId || !body.name?.trim()) {
    return c.json({ error: 'workspaceId and name required' }, 400)
  }

  const { data, error } = await (lf('chat_channels') as any)
    .insert({
      workspace_id: body.workspaceId,
      name: body.name.trim(),
      description: body.description ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// ── GET /api/chat/channels/:id/messages?before=&limit= ───────────────────────
// Paginated message history. Returns 50 messages, newest last.
// Pass ?before=<ISO timestamp> to load older messages.

r.get('/channels/:id/messages', requireAuth, async (c) => {
  const channelId = c.req.param('id')
  const before = c.req.query('before')
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 100)

  let q = (lf('chat_messages') as any)
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    q = q.lt('created_at', before)
  }

  const { data, error } = await q
  if (error) return c.json({ error: error.message }, 500)

  // Return in ascending order so client renders top-to-bottom
  const messages = (data ?? []).reverse()
  return c.json({ messages })
})

// ── POST /api/chat/channels/:id/messages ────────────────────────────────────
// Send a text message

r.post('/channels/:id/messages', requireAuth, async (c) => {
  const user = c.get('user')
  const channelId = c.req.param('id')
  const body = await c.req.json() as { body: string; task_id?: string | null }

  if (!body.body?.trim()) return c.json({ error: 'body required' }, 400)

  // Look up the channel to get workspace_id
  const { data: channel, error: chErr } = await (lf('chat_channels') as any)
    .select('workspace_id')
    .eq('id', channelId)
    .single()

  if (chErr || !channel) return c.json({ error: 'Channel not found' }, 404)

  const { data: msg, error } = await (lf('chat_messages') as any)
    .insert({
      channel_id: channelId,
      workspace_id: channel.workspace_id,
      user_id: user.id,
      body: body.body.trim(),
      task_id: body.task_id ?? null,
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)

  emitChatMessage(msg as Record<string, unknown>)
  return c.json(msg, 201)
})

// ── POST /api/chat/channels/:id/upload ──────────────────────────────────────
// Upload image/file → Supabase Storage → insert message with file_url

r.post('/channels/:id/upload', requireAuth, async (c) => {
  const user = c.get('user')
  const channelId = c.req.param('id')

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'file required' }, 400)

  // Look up channel
  const { data: channel, error: chErr } = await (lf('chat_channels') as any)
    .select('workspace_id')
    .eq('id', channelId)
    .single()

  if (chErr || !channel) return c.json({ error: 'Channel not found' }, 404)

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `chat/${channel.workspace_id}/${channelId}/${randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('listflow-audio')
    .upload(storagePath, buffer, { contentType: file.type })

  if (uploadError) {
    return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500)
  }

  const { data: { publicUrl } } = supabase.storage
    .from('listflow-audio')
    .getPublicUrl(storagePath)

  const { data: msg, error } = await (lf('chat_messages') as any)
    .insert({
      channel_id: channelId,
      workspace_id: channel.workspace_id,
      user_id: user.id,
      body: '',
      file_url: publicUrl,
      file_name: file.name,
      file_type: file.type,
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)

  emitChatMessage(msg as Record<string, unknown>)
  return c.json(msg, 201)
})

// ── PATCH /api/chat/channels/:id/messages/:msgId ────────────────────────────
// Edit a message body (own messages only)

r.patch('/channels/:id/messages/:msgId', requireAuth, async (c) => {
  const user = c.get('user')
  const msgId = c.req.param('msgId')
  const body = await c.req.json() as { body: string }

  if (!body.body?.trim()) return c.json({ error: 'body required' }, 400)

  // Fetch existing message and verify ownership
  const { data: existing, error: fetchErr } = await (lf('chat_messages') as any)
    .select('*')
    .eq('id', msgId)
    .single()

  if (fetchErr || !existing) return c.json({ error: 'Message not found' }, 404)
  if (existing.user_id !== user.id) return c.json({ error: 'Not your message' }, 403)

  const { data: updated, error } = await (lf('chat_messages') as any)
    .update({ body: body.body.trim(), updated_at: new Date().toISOString() })
    .eq('id', msgId)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)

  emitChatMessageUpdated(updated as Record<string, unknown>)
  return c.json(updated)
})

// ── DELETE /api/chat/channels/:id/messages/:msgId?scope=self|everyone ────────
// Delete a message. scope=self → soft-delete for current user only (sets deleted_for_user_id).
//                   scope=everyone → marks body as deleted for all (own messages only).

r.delete('/channels/:id/messages/:msgId', requireAuth, async (c) => {
  const user = c.get('user')
  const msgId = c.req.param('msgId')
  const scope = (c.req.query('scope') ?? 'self') as 'self' | 'everyone'
  const channelId = c.req.param('id')

  const { data: existing, error: fetchErr } = await (lf('chat_messages') as any)
    .select('*')
    .eq('id', msgId)
    .single()

  if (fetchErr || !existing) return c.json({ error: 'Message not found' }, 404)

  if (scope === 'everyone') {
    // Only own messages can be deleted for everyone
    if (existing.user_id !== user.id) return c.json({ error: 'Not your message' }, 403)
    const { error } = await (lf('chat_messages') as any)
      .update({ body: '', file_url: null, file_name: null, file_type: null, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', msgId)
    if (error) return c.json({ error: error.message }, 500)
  } else {
    // scope=self: store user id in deleted_for array
    const deletedFor: string[] = Array.isArray(existing.deleted_for) ? existing.deleted_for : []
    if (!deletedFor.includes(user.id)) {
      const { error } = await (lf('chat_messages') as any)
        .update({ deleted_for: [...deletedFor, user.id], updated_at: new Date().toISOString() })
        .eq('id', msgId)
      if (error) return c.json({ error: error.message }, 500)
    }
  }

  emitChatMessageDeleted(msgId, channelId, scope, user.id)
  return c.json({ ok: true })
})

// ── POST /api/chat/channels/:id/pin-task ────────────────────────────────────
// Create a task from a chat message

r.post('/channels/:id/pin-task', requireAuth, async (c) => {
  const user = c.get('user')
  const channelId = c.req.param('id')
  const body = await c.req.json() as { messageId: string; workspaceId: string }

  if (!body.messageId || !body.workspaceId) {
    return c.json({ error: 'messageId and workspaceId required' }, 400)
  }

  // Fetch the source message
  const { data: msg, error: msgErr } = await (lf('chat_messages') as any)
    .select('*')
    .eq('id', body.messageId)
    .eq('channel_id', channelId)
    .single()

  if (msgErr || !msg) return c.json({ error: 'Message not found' }, 404)

  const titleText = (msg.body || msg.file_name || 'Chat task').slice(0, 120)

  // Create task
  const { data: task, error: taskErr } = await (lf('tasks') as any)
    .insert({
      workspace_id: body.workspaceId,
      title: titleText,
      description: msg.body || '',
      status: 'todo',
      priority: 'medium',
      assignee_ids: [],
      labels: ['chat'],
      created_by: user.id,
      position: 0,
    })
    .select()
    .single()

  if (taskErr) return c.json({ error: taskErr.message }, 500)

  // Link task back to the message
  await (lf('chat_messages') as any)
    .update({ task_id: task.id })
    .eq('id', body.messageId)

  emitTaskCreated(task as Record<string, unknown>)

  return c.json({ task, message: { ...msg, task_id: task.id } }, 201)
})

// ── POST /api/chat/typing ────────────────────────────────────────────────────
// Ephemeral typing indicator — no DB write

r.post('/typing', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json() as { channelId: string; name?: string }
  if (!body.channelId) return c.json({ error: 'channelId required' }, 400)

  emitChatTyping(body.channelId, user.id, body.name ?? user.email ?? 'Someone')
  return c.json({ ok: true })
})

export default r
