import { Hono } from 'hono'
import { lf } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'

const r = new Hono()

// GET /api/workspaces — list all workspaces for current user
r.get('/', requireAuth, async (c) => {
  const user = c.get('user')

  // 1. Workspaces the user owns
  const { data: owned, error: e1 } = await (lf('workspaces') as any)
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: true })

  if (e1) return c.json({ error: e1.message }, 500)

  // 2. Workspaces the user is a member of (but doesn't own)
  const { data: memberRows, error: e2 } = await (lf('workspace_members') as any)
    .select('workspace_id')
    .eq('user_id', user.id)

  if (e2) return c.json({ error: e2.message }, 500)

  const memberWsIds: string[] = (memberRows ?? [])
    .map((r: any) => r.workspace_id)
    .filter((id: string) => !(owned ?? []).find((w: any) => w.id === id))

  let memberWs: any[] = []
  if (memberWsIds.length > 0) {
    const { data: mws, error: e3 } = await (lf('workspaces') as any)
      .select('*')
      .in('id', memberWsIds)
      .order('created_at', { ascending: true })
    if (e3) return c.json({ error: e3.message }, 500)
    memberWs = mws ?? []
  }

  const workspaces = [...(owned ?? []), ...memberWs]
  return c.json({ workspaces })
})

// GET /api/workspaces/:id
r.get('/:id', requireAuth, async (c) => {
  const { data, error } = await (lf('workspaces') as any)
    .select('*, workspace_members(user_id, role, joined_at)')
    .eq('id', c.req.param('id'))
    .single()

  if (error || !data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// POST /api/workspaces — create workspace
r.post('/', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json() as { name: string; type?: string; icon?: string; description?: string }

  const { data, error } = await (lf('workspaces') as any)
    .insert({
      name: body.name,
      type: body.type ?? 'personal',
      owner_id: user.id,
      icon: body.icon ?? null,
      description: body.description ?? null,
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)

  // Auto-add owner as member
  await (lf('workspace_members') as any).insert({
    workspace_id: data.id,
    user_id: user.id,
    role: 'owner',
  })

  return c.json(data, 201)
})

// PATCH /api/workspaces/:id
r.patch('/:id', requireAuth, async (c) => {
  const body = await c.req.json() as Record<string, unknown>
  const allowed = ['name', 'icon', 'description']
  const updates: Record<string, unknown> = {}
  for (const k of allowed) if (body[k] !== undefined) updates[k] = body[k]

  const { data, error } = await (lf('workspaces') as any)
    .update(updates)
    .eq('id', c.req.param('id'))
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// DELETE /api/workspaces/:id
r.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const { error } = await (lf('workspaces') as any)
    .delete()
    .eq('id', c.req.param('id'))
    .eq('owner_id', user.id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

// GET /api/workspaces/:id/members
r.get('/:id/members', requireAuth, async (c) => {
  const { data, error } = await (lf('workspace_members') as any)
    .select('*')
    .eq('workspace_id', c.req.param('id'))

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ members: data })
})

// POST /api/workspaces/:id/members — invite member
r.post('/:id/members', requireAuth, async (c) => {
  const body = await c.req.json() as { userId: string; role?: string }
  const { data, error } = await (lf('workspace_members') as any)
    .insert({
      workspace_id: c.req.param('id'),
      user_id: body.userId,
      role: body.role ?? 'member',
    })
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// DELETE /api/workspaces/:id/members/:userId
r.delete('/:id/members/:userId', requireAuth, async (c) => {
  const { error } = await (lf('workspace_members') as any)
    .delete()
    .eq('workspace_id', c.req.param('id'))
    .eq('user_id', c.req.param('userId'))

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

export default r
