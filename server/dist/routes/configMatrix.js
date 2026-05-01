import { Hono } from 'hono';
import { lf } from '../db/client.js';
const r = new Hono();
// ── Get full config matrix ────────────────────────────────────────────────────
r.get('/', async (c) => {
    const { data, error } = await lf('config_matrix')
        .select('*')
        .order('feature')
        .order('role');
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ matrix: data });
});
// ── Upsert a single feature×role entry ───────────────────────────────────────
r.put('/', async (c) => {
    const body = await c.req.json(); // { feature, role, enabled, updatedBy? }
    const { data, error } = await lf('config_matrix')
        .upsert({
        feature: body.feature,
        role: body.role,
        enabled: body.enabled,
        updated_by: body.updatedBy ?? null,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'feature,role' })
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data);
});
// ── Bulk upsert (save entire matrix at once) ──────────────────────────────────
r.put('/bulk', async (c) => {
    const { rows } = await c.req.json(); // rows: { feature, role, enabled }[]
    if (!Array.isArray(rows))
        return c.json({ error: 'rows must be array' }, 400);
    const { data, error } = await lf('config_matrix')
        .upsert(rows.map((r) => ({
        feature: r.feature,
        role: r.role,
        enabled: r.enabled,
        updated_by: r.updatedBy ?? null,
        updated_at: new Date().toISOString(),
    })), { onConflict: 'feature,role' })
        .select();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ matrix: data });
});
export default r;
