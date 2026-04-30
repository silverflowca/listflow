import { Hono } from 'hono'
import { lf } from '../db/client.js'

const r = new Hono()

// ── List all app users ────────────────────────────────────────────────────────
r.get('/', async (c) => {
  const { data, error } = await (lf('app_users') as any)
    .select('*')
    .order('name')
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ users: data })
})

// ── Get single user ───────────────────────────────────────────────────────────
r.get('/:id', async (c) => {
  const { data, error } = await (lf('app_users') as any).select('*').eq('id', c.req.param('id')).single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

// ── Create / register user ────────────────────────────────────────────────────
r.post('/', async (c) => {
  const body = await c.req.json()
  const { data, error } = await (lf('app_users') as any).insert(body).select().single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// ── Update user (role, status, name, avatar_url, color) ───────────────────────
r.patch('/:id', async (c) => {
  const body = await c.req.json()
  const { data, error } = await (lf('app_users') as any)
    .update(body)
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// ── Delete / deactivate user ──────────────────────────────────────────────────
r.delete('/:id', async (c) => {
  // Soft-delete: set status = suspended rather than hard delete
  const { error } = await (lf('app_users') as any)
    .update({ status: 'suspended' })
    .eq('id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

// ── Upsert user from auth (called on first login) ─────────────────────────────
r.post('/sync', async (c) => {
  const body = await c.req.json() // { id, email, name?, avatar_url? }
  const { data, error } = await (lf('app_users') as any)
    .upsert({
      id: body.id,
      email: body.email,
      name: body.name ?? body.email.split('@')[0],
      avatar_url: body.avatar_url ?? null,
      status: 'active',
    }, { onConflict: 'id' })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

export default r
