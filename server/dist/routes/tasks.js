import { Hono } from 'hono';
import { lf } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { emitTaskCreated, emitTaskUpdated, emitTaskNotification } from '../lib/ws.js';
const r = new Hono();
// GET /api/tasks?workspaceId=&workspaceIds=id1,id2&ids=id1,id2&status=&priority=&limit=
r.get('/', requireAuth, async (c) => {
    const { workspaceId, workspaceIds, ids: idsParam, status, priority, databaseId } = c.req.query();
    const limit = parseInt(c.req.query('limit') ?? '200');
    // ?ids= fetches specific tasks by UUID list (for deep-links / getMany)
    if (idsParam) {
        const taskIds = idsParam.split(',').filter(Boolean).slice(0, 50);
        const { data, error } = await lf('tasks')
            .select('*, subtasks(id, title, completed, position), comments(id, user_id, content, created_at)')
            .in('id', taskIds);
        if (error)
            return c.json({ error: error.message }, 500);
        return c.json({ tasks: data ?? [] });
    }
    if (!workspaceId && !workspaceIds)
        return c.json({ error: 'workspaceId required' }, 400);
    const wsIds = workspaceIds ? workspaceIds.split(',').filter(Boolean) : [workspaceId];
    let q = lf('tasks')
        .select('*, subtasks(id, title, completed, position), comments(id, user_id, content, created_at)')
        .in('workspace_id', wsIds)
        .order('position', { ascending: true })
        .limit(limit);
    if (status)
        q = q.eq('status', status);
    if (priority)
        q = q.eq('priority', priority);
    if (databaseId)
        q = q.eq('database_id', databaseId);
    const { data, error } = await q;
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ tasks: data });
});
// GET /api/tasks/:id
r.get('/:id', requireAuth, async (c) => {
    const { data, error } = await lf('tasks')
        .select('*, subtasks(*, position), comments(*, created_at)')
        .eq('id', c.req.param('id'))
        .single();
    if (error || !data)
        return c.json({ error: 'Not found' }, 404);
    return c.json(data);
});
// POST /api/tasks
r.post('/', requireAuth, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { data, error } = await lf('tasks')
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
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    emitTaskCreated(data);
    return c.json(data, 201);
});
// PATCH /api/tasks/:id
r.patch('/:id', requireAuth, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const allowed = ['title', 'description', 'status', 'priority', 'assignee_ids', 'notify_user_ids', 'due_date', 'labels', 'position', 'parent_task_id', 'database_id', 'effort_points'];
    const updates = {};
    for (const k of allowed)
        if (body[k] !== undefined)
            updates[k] = body[k];
    const { data, error } = await lf('tasks')
        .update(updates)
        .eq('id', c.req.param('id'))
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    emitTaskUpdated(data);
    // Notify watchers (if task has notify_user_ids and it wasn't just a watcher-list change)
    const notifyIds = Array.isArray(data.notify_user_ids) ? data.notify_user_ids : [];
    if (notifyIds.length > 0 && !('notify_user_ids' in updates && Object.keys(updates).length === 1)) {
        emitTaskNotification(data, user.id);
    }
    return c.json(data);
});
// DELETE /api/tasks/:id
r.delete('/:id', requireAuth, async (c) => {
    const { error } = await lf('tasks')
        .delete()
        .eq('id', c.req.param('id'));
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
// ── Subtasks ──────────────────────────────────────────────────────────────────
// POST /api/tasks/:id/subtasks
r.post('/:id/subtasks', requireAuth, async (c) => {
    const body = await c.req.json();
    const { data, error } = await lf('subtasks')
        .insert({ task_id: c.req.param('id'), title: body.title, position: body.position ?? 0 })
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});
// PATCH /api/tasks/:id/subtasks/:sid
r.patch('/:id/subtasks/:sid', requireAuth, async (c) => {
    const body = await c.req.json();
    const { data, error } = await lf('subtasks')
        .update(body)
        .eq('id', c.req.param('sid'))
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data);
});
// DELETE /api/tasks/:id/subtasks/:sid
r.delete('/:id/subtasks/:sid', requireAuth, async (c) => {
    const { error } = await lf('subtasks')
        .delete()
        .eq('id', c.req.param('sid'));
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
// ── Comments ──────────────────────────────────────────────────────────────────
// POST /api/tasks/:id/comments
r.post('/:id/comments', requireAuth, async (c) => {
    const user = c.get('user');
    const body = await c.req.json();
    const { data, error } = await lf('comments')
        .insert({ task_id: c.req.param('id'), user_id: user.id, content: body.content })
        .select()
        .single();
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json(data, 201);
});
// DELETE /api/tasks/:id/comments/:cid
r.delete('/:id/comments/:cid', requireAuth, async (c) => {
    const { error } = await lf('comments')
        .delete()
        .eq('id', c.req.param('cid'));
    if (error)
        return c.json({ error: error.message }, 500);
    return c.json({ ok: true });
});
export default r;
