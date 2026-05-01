import { Hono } from 'hono';
import { lf } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
const r = new Hono();
// GET /api/blocks?pageId=
r.get('/', requireAuth, async (c) => {
    const pageId = c.req.query('pageId');
    if (!pageId)
        return c.json({ error: 'pageId required' }, 400);
    const { data, error } = await lf('blocks')
        .select('*')
        .eq('page_id', pageId)
        .order('position', { ascending: true });
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ blocks: data });
});
// GET /api/blocks/:id
r.get('/:id', requireAuth, async (c) => {
    const { data, error } = await lf('blocks')
        .select('*')
        .eq('id', c.req.param('id'))
        .single();
    if (error || !data)
        return c.json({ error: 'Not found' }, 404);
    return c.json(data);
});
// POST /api/blocks
r.post('/', requireAuth, async (c) => {
    const body = await c.req.json();
    const { data, error } = await lf('blocks')
        .insert({
        page_id: body.pageId,
        type: body.type ?? 'text',
        content: body.content ?? { text: '' },
        position: body.position ?? 0,
        parent_block_id: body.parentBlockId ?? null,
    })
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});
// PATCH /api/blocks/:id
r.patch('/:id', requireAuth, async (c) => {
    const body = await c.req.json();
    const allowed = ['type', 'content', 'position', 'parent_block_id'];
    const updates = {};
    for (const k of allowed)
        if (body[k] !== undefined)
            updates[k] = body[k];
    const { data, error } = await lf('blocks')
        .update(updates)
        .eq('id', c.req.param('id'))
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data);
});
// DELETE /api/blocks/:id
r.delete('/:id', requireAuth, async (c) => {
    const { error } = await lf('blocks')
        .delete()
        .eq('id', c.req.param('id'));
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
// POST /api/blocks/reorder — bulk position update
r.post('/reorder', requireAuth, async (c) => {
    const body = await c.req.json();
    const promises = body.updates.map(({ id, position }) => lf('blocks').update({ position }).eq('id', id));
    await Promise.all(promises);
    return c.json({ ok: true });
});
export default r;
