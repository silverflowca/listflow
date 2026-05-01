import { Hono } from 'hono';
import { lf } from '../db/client.js';
const r = new Hono();
// ── List all groups (with member count) ───────────────────────────────────────
r.get('/', async (c) => {
    const { data, error } = await lf('user_groups')
        .select('*, group_members(user_id, role, joined_at, app_users(id, name, email, color, initials))')
        .order('name');
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ groups: data });
});
// ── Get single group ──────────────────────────────────────────────────────────
r.get('/:id', async (c) => {
    const { data, error } = await lf('user_groups')
        .select('*, group_members(user_id, role, joined_at, app_users(id, name, email, color, initials))')
        .eq('id', c.req.param('id'))
        .single();
    if (error)
        return c.json({ error: error.message }, 404);
    return c.json(data);
});
// ── Create group ──────────────────────────────────────────────────────────────
r.post('/', async (c) => {
    const body = await c.req.json();
    const { data, error } = await lf('user_groups').insert(body).select().single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});
// ── Update group ──────────────────────────────────────────────────────────────
r.patch('/:id', async (c) => {
    const body = await c.req.json();
    const { data, error } = await lf('user_groups')
        .update(body).eq('id', c.req.param('id')).select().single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data);
});
// ── Delete group ──────────────────────────────────────────────────────────────
r.delete('/:id', async (c) => {
    const { error } = await lf('user_groups').delete().eq('id', c.req.param('id'));
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
// ── Add member ────────────────────────────────────────────────────────────────
r.post('/:id/members', async (c) => {
    const body = await c.req.json();
    const { data, error } = await lf('group_members')
        .insert({ group_id: c.req.param('id'), user_id: body.userId, role: body.role ?? 'member' })
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});
// ── Remove member ─────────────────────────────────────────────────────────────
r.delete('/:id/members/:userId', async (c) => {
    const { error } = await lf('group_members')
        .delete()
        .eq('group_id', c.req.param('id'))
        .eq('user_id', c.req.param('userId'));
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
// ── Update member role ────────────────────────────────────────────────────────
r.patch('/:id/members/:userId', async (c) => {
    const { role } = await c.req.json();
    const { data, error } = await lf('group_members')
        .update({ role })
        .eq('group_id', c.req.param('id'))
        .eq('user_id', c.req.param('userId'))
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data);
});
export default r;
