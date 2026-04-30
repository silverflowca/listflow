import { Hono } from 'hono'
import { lf } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { runAgent } from '../lib/agent.js'

const r = new Hono()

// POST /api/agent/run — manually trigger agent with a prompt
r.post('/run', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json() as {
    workspaceId: string
    prompt: string
    transcriptId?: string
    maxIterations?: number
  }

  if (!body.workspaceId || !body.prompt) {
    return c.json({ error: 'workspaceId and prompt required' }, 400)
  }

  // Create agent run record
  const { data: run, error: runErr } = await (lf('agent_runs') as any)
    .insert({
      workspace_id: body.workspaceId,
      transcript_id: body.transcriptId ?? null,
      prompt: body.prompt,
      status: 'running',
    })
    .select()
    .single()

  if (runErr) return c.json({ error: runErr.message }, 500)

  // Run agent async
  runAgent({
    runId: run.id,
    workspaceId: body.workspaceId,
    prompt: body.prompt,
    createdBy: user.id,
    transcriptId: body.transcriptId,
    maxIterations: body.maxIterations ?? 20,
  }).catch((err) => console.error('[agent] Run failed:', err))

  return c.json({ runId: run.id, status: 'running' })
})

// GET /api/agent/runs?workspaceId=&limit=
r.get('/runs', requireAuth, async (c) => {
  const workspaceId = c.req.query('workspaceId')
  const limit = parseInt(c.req.query('limit') ?? '20')

  if (!workspaceId) return c.json({ error: 'workspaceId required' }, 400)

  const { data, error } = await (lf('agent_runs') as any)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ runs: data })
})

// GET /api/agent/runs/:id
r.get('/runs/:id', requireAuth, async (c) => {
  const { data, error } = await (lf('agent_runs') as any)
    .select('*')
    .eq('id', c.req.param('id'))
    .single()

  if (error || !data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})

// GET /api/agent/memory?workspaceId=
r.get('/memory', requireAuth, async (c) => {
  const workspaceId = c.req.query('workspaceId')
  if (!workspaceId) return c.json({ error: 'workspaceId required' }, 400)

  const { data, error } = await (lf('agent_memory') as any)
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ memory: data })
})

// DELETE /api/agent/memory/:key?workspaceId=
r.delete('/memory/:key', requireAuth, async (c) => {
  const workspaceId = c.req.query('workspaceId')
  const { error } = await (lf('agent_memory') as any)
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('key', c.req.param('key'))

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ ok: true })
})

export default r
