import { Hono } from 'hono'
import { lf } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'

const r = new Hono()

// GET /api/pages?workspaceId=
r.get('/', requireAuth, async (c) => {
  const workspaceId = c.req.query('workspaceId')
  if (!workspaceId) return c.json({ error: 'workspaceId required' }, 400)

  const { data, error } = await (lf('pages') as any)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('position', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ pages: data })
})

// GET /api/pages/:id
r.get('/:id', requireAuth, async (c) => {
  const { data, error } = await (lf('pages') as any)
    .select('*')
    .eq('id', c.req.param('id'))
    .single()

  if (error || !data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// POST /api/pages
r.post('/', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json() as {
    workspaceId: string
    title?: string
    parentId?: string
    icon?: string
    isDatabase?: boolean
    position?: number
  }

  const { data, error } = await (lf('pages') as any)
    .insert({
      workspace_id: body.workspaceId,
      title: body.title ?? 'Untitled',
      parent_id: body.parentId ?? null,
      icon: body.icon ?? null,
      is_database: body.isDatabase ?? false,
      created_by: user.id,
      position: body.position ?? 0,
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// PATCH /api/pages/:id
r.patch('/:id', requireAuth, async (c) => {
  const body = await c.req.json() as Record<string, unknown>
  const allowed = ['title', 'icon', 'cover_url', 'parent_id', 'position', 'is_database']
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k]

  const { data, error } = await (lf('pages') as any)
    .update(updates)
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// DELETE /api/pages/:id
r.delete('/:id', requireAuth, async (c) => {
  const { error } = await (lf('pages') as any)
    .delete()
    .eq('id', c.req.param('id'))

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

export default r
