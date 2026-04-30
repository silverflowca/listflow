import { Hono } from 'hono'
import { lf } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { emitTaskCreated, emitTaskUpdated } from '../lib/ws.js'

const r = new Hono()

// GET /api/tasks?workspaceId=&status=&priority=&limit=
r.get('/', requireAuth, async (c) => {
  const { workspaceId, status, priority, databaseId } = c.req.query()
  const limit = parseInt(c.req.query('limit') ?? '200')

  if (!workspaceId) return c.json({ error: 'workspaceId required' }, 400)

  let q = (lf('tasks') as any)
    .select('*, subtasks(id, title, completed, position), comments(id, user_id, content, created_at)')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })
    .limit(limit)

  if (status) q = q.eq('status', status)
  if (priority) q = q.eq('priority', priority)
  if (databaseId) q = q.eq('database_id', databaseId)

  const { data, error } = await q
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ tasks: data })
})

// GET /api/tasks/:id
r.get('/:id', requireAuth, async (c) => {
  const { data, error } = await (lf('tasks') as any)
    .select('*, subtasks(*, position), comments(*, created_at)')
    .eq('id', c.req.param('id'))
    .single()

  if (error || !data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// POST /api/tasks
r.post('/', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json() as {
    workspaceId: string
    title: string
    description?: string
    status?: string
    priority?: string
    assigneeIds?: string[]
    parentTaskId?: string
    databaseId?: string
    dueDate?: string
    labels?: string[]
    position?: number
  }

  const { data, error } = await (lf('tasks') as any)
    .insert({
      workspace_id: body.workspaceId,
      title: body.title,
      description: body.description ?? '',
      status: body.status ?? 'todo',
      priority: body.priority ?? 'medium',
      assignee_ids: body.assigneeIds ?? [],
      parent_task_id: body.parentTaskId ?? null,
      database_id: body.databaseId ?? null,
      due_date: body.dueDate ?? null,
      labels: body.labels ?? [],
      created_by: user.id,
      position: body.position ?? 0,
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  emitTaskCreated(data as Record<string, unknown>)
  return c.json(data, 201)
})

// PATCH /api/tasks/:id
r.patch('/:id', requireAuth, async (c) => {
  const body = await c.req.json() as Record<string, unknown>
  const allowed = ['title', 'description', 'status', 'priority', 'assignee_ids', 'due_date', 'labels', 'position', 'parent_task_id', 'database_id']
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k]

  const { data, error } = await (lf('tasks') as any)
    .update(updates)
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  emitTaskUpdated(data as Record<string, unknown>)
  return c.json(data)
})

// DELETE /api/tasks/:id
r.delete('/:id', requireAuth, async (c) => {
  const { error } = await (lf('tasks') as any)
    .delete()
    .eq('id', c.req.param('id'))

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

// ── Subtasks ──────────────────────────────────────────────────────────────────

// POST /api/tasks/:id/subtasks
r.post('/:id/subtasks', requireAuth, async (c) => {
  const body = await c.req.json() as { title: string; position?: number }
  const { data, error } = await (lf('subtasks') as any)
    .insert({ task_id: c.req.param('id'), title: body.title, position: body.position ?? 0 })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// PATCH /api/tasks/:id/subtasks/:sid
r.patch('/:id/subtasks/:sid', requireAuth, async (c) => {
  const body = await c.req.json() as { title?: string; completed?: boolean; position?: number }
  const { data, error } = await (lf('subtasks') as any)
    .update(body)
    .eq('id', c.req.param('sid'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// DELETE /api/tasks/:id/subtasks/:sid
r.delete('/:id/subtasks/:sid', requireAuth, async (c) => {
  const { error } = await (lf('subtasks') as any)
    .delete()
    .eq('id', c.req.param('sid'))

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

// ── Comments ──────────────────────────────────────────────────────────────────

// POST /api/tasks/:id/comments
r.post('/:id/comments', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json() as { content: string }
  const { data, error } = await (lf('comments') as any)
    .insert({ task_id: c.req.param('id'), user_id: user.id, content: body.content })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// DELETE /api/tasks/:id/comments/:cid
r.delete('/:id/comments/:cid', requireAuth, async (c) => {
  const { error } = await (lf('comments') as any)
    .delete()
    .eq('id', c.req.param('cid'))

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

export default r
