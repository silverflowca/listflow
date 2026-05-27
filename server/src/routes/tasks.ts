import { Hono } from 'hono'
import { lf } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { emitTaskCreated, emitTaskUpdated, emitTaskNotification } from '../lib/ws.js'

const r = new Hono()

// GET /api/tasks?workspaceId=&workspaceIds=id1,id2&ids=id1,id2&status=&priority=&limit=
r.get('/', requireAuth, async (c) => {
  const { workspaceId, workspaceIds, ids: idsParam, status, priority, databaseId } = c.req.query()
  const limit = parseInt(c.req.query('limit') ?? '200')

  // ?ids= fetches specific tasks — supports both UUIDs and short IDs (e.g. KDT042)
  if (idsParam) {
    const params = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 50)
    const SHORT_ID_RE = /^[A-Z]{1,3}\d+$/
    const shortParams = params.filter(p => SHORT_ID_RE.test(p))
    const uuidParams  = params.filter(p => !SHORT_ID_RE.test(p))

    let resolvedIds: string[] = [...uuidParams]

    if (shortParams.length > 0) {
      // Fetch all workspaces to map initials → workspace IDs
      const { data: allWs } = await (lf('workspaces') as any).select('id, name')
      const wsAll: { id: string; name: string }[] = allWs ?? []
      const initialsMap: Record<string, string[]> = {}
      for (const ws of wsAll) {
        const init = ws.name.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').join('').slice(0, 3)
        if (!initialsMap[init]) initialsMap[init] = []
        initialsMap[init].push(ws.id)
      }
      const lookups = shortParams.map(p => {
        const match = p.match(/^([A-Z]{1,3})(\d+)$/)!
        return { initials: match[1], taskNumber: parseInt(match[2]) }
      })
      const wsIdsForLookup = [...new Set(lookups.flatMap(l => initialsMap[l.initials] ?? []))]
      if (wsIdsForLookup.length > 0) {
        const allNumbers = lookups.map(l => l.taskNumber)
        const { data: found } = await (lf('tasks') as any)
          .select('id, task_number, workspace_id')
          .in('workspace_id', wsIdsForLookup)
          .in('task_number', allNumbers)
        for (const t of (found ?? []) as { id: string; task_number: number; workspace_id: string }[]) {
          const ws = wsAll.find(w => w.id === t.workspace_id)
          if (!ws) continue
          const init = ws.name.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').join('').slice(0, 3)
          if (lookups.some(l => l.initials === init && l.taskNumber === t.task_number)) {
            resolvedIds.push(t.id)
          }
        }
      }
    }

    if (resolvedIds.length === 0) return c.json({ tasks: [] })
    const { data, error } = await (lf('tasks') as any)
      .select('*, subtasks(id, title, completed, position), comments(id, user_id, content, created_at)')
      .in('id', resolvedIds)
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ tasks: data ?? [] })
  }

  if (!workspaceId && !workspaceIds) return c.json({ error: 'workspaceId required' }, 400)

  const wsIds = workspaceIds ? workspaceIds.split(',').filter(Boolean) : [workspaceId!]

  let q = (lf('tasks') as any)
    .select('*, subtasks(id, title, completed, position), comments(id, user_id, content, created_at)')
    .in('workspace_id', wsIds)
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
  const user = c.get('user')
  const body = await c.req.json() as Record<string, unknown>
  const allowed = ['title', 'description', 'status', 'priority', 'assignee_ids', 'notify_user_ids', 'due_date', 'labels', 'position', 'parent_task_id', 'database_id', 'effort_points']
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k]

  const { data, error } = await (lf('tasks') as any)
    .update(updates)
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  emitTaskUpdated(data as Record<string, unknown>)
  // Notify watchers (if task has notify_user_ids and it wasn't just a watcher-list change)
  const notifyIds: string[] = Array.isArray(data.notify_user_ids) ? data.notify_user_ids : []
  if (notifyIds.length > 0 && !('notify_user_ids' in updates && Object.keys(updates).length === 1)) {
    emitTaskNotification(data as Record<string, unknown>, user.id)
  }
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
