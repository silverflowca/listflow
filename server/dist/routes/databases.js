import { Hono } from 'hono';
import { lf } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
const r = new Hono();
// GET /api/databases?pageId=
r.get('/', requireAuth, async (c) => {
    const pageId = c.req.query('pageId');
    let q = lf('databases').select('*');
    if (pageId)
        q = q.eq('page_id', pageId);
    const { data, error } = await q;
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ databases: data });
});
// GET /api/databases/:id
r.get('/:id', requireAuth, async (c) => {
    const { data, error } = await lf('databases')
        .select('*')
        .eq('id', c.req.param('id'))
        .single();
    if (error || !data)
        return c.json({ error: 'Not found' }, 404);
    return c.json(data);
});
// POST /api/databases
r.post('/', requireAuth, async (c) => {
    const body = await c.req.json();
    const { data, error } = await lf('databases')
        .insert({
        page_id: body.pageId,
        name: body.name ?? 'Database',
        schema_def: body.schemaDef ?? [],
    })
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});
// PATCH /api/databases/:id
r.patch('/:id', requireAuth, async (c) => {
    const body = await c.req.json();
    const updates = {};
    if (body.name !== undefined)
        updates.name = body.name;
    if (body.schemaDef !== undefined)
        updates.schema_def = body.schemaDef;
    const { data, error } = await lf('databases')
        .update(updates)
        .eq('id', c.req.param('id'))
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data);
});
// DELETE /api/databases/:id
r.delete('/:id', requireAuth, async (c) => {
    const { error } = await lf('databases')
        .delete()
        .eq('id', c.req.param('id'));
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
// ── Entries ───────────────────────────────────────────────────────────────────
// GET /api/databases/:id/entries
r.get('/:id/entries', requireAuth, async (c) => {
    const { data, error } = await lf('entries')
        .select('*')
        .eq('database_id', c.req.param('id'))
        .order('created_at', { ascending: true });
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ entries: data });
});
// POST /api/databases/:id/entries
r.post('/:id/entries', requireAuth, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { data, error } = await lf('entries')
        .insert({
        database_id: c.req.param('id'),
        workspace_id: body.workspaceId,
        properties: body.properties ?? {},
        created_by: user.id,
    })
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});
// PATCH /api/databases/:id/entries/:eid
r.patch('/:id/entries/:eid', requireAuth, async (c) => {
    const body = await c.req.json();
    const { data, error } = await lf('entries')
        .update({ properties: body.properties })
        .eq('id', c.req.param('eid'))
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data);
});
// DELETE /api/databases/:id/entries/:eid
r.delete('/:id/entries/:eid', requireAuth, async (c) => {
    const { error } = await lf('entries')
        .delete()
        .eq('id', c.req.param('eid'));
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
export default r;
