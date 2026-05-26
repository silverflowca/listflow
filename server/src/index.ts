import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createServer } from 'http'

import { loadConfigCache } from './lib/config.js'
import { initWss } from './lib/ws.js'
import { lf } from './db/client.js'

import workspacesRouter from './routes/workspaces.js'
import pagesRouter from './routes/pages.js'
import blocksRouter from './routes/blocks.js'
import databasesRouter from './routes/databases.js'
import tasksRouter from './routes/tasks.js'
import audioRouter from './routes/audio.js'
import agentRouter from './routes/agentRoute.js'
import settingsRouter from './routes/settings.js'
import usersRouter from './routes/users.js'
import groupsRouter from './routes/groups.js'
import configMatrixRouter from './routes/configMatrix.js'
import chatRouter from './routes/chat.js'

// In single-service Railway deploys, NODE_PORT is always 3016 (internal, nginx proxies to it).
// Railway's PORT env var is reserved for the public-facing nginx listener.
const PORT = Number(process.env.NODE_PORT ?? process.env.PORT ?? 3016)
const ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:5186'

const app = new Hono()

// ── Middleware ────────────────────────────────────────────────────────────────

app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return '*'
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return origin
    if (origin === ORIGIN) return origin
    return null
  },
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ ok: true, service: 'listflow-server', port: PORT }))
app.get('/ready', (c) => c.json({ ok: true }))

// ── Share page (OG preview for WhatsApp/iMessage) ─────────────────────────────
// No auth required — only returns public task title + short ID for preview

app.get('/share', async (c) => {
  const rawIds = c.req.query('ids') ?? ''
  const taskIds = rawIds.split(',').filter(Boolean).slice(0, 10)

  if (taskIds.length === 0) {
    return c.html('<!DOCTYPE html><html><head><title>ListFlow</title></head><body><script>location.replace(\'/\')</script></body></html>')
  }

  // Fetch tasks (no auth — service role client)
  const { data: tasks } = await (lf('tasks') as any)
    .select('id, title, task_number, workspace_id')
    .in('id', taskIds)

  // Fetch workspace names for the tasks found
  const wsIds = [...new Set((tasks ?? []).map((t: Record<string, unknown>) => t.workspace_id as string))]
  const { data: workspaces } = await (lf('workspaces') as any)
    .select('id, name')
    .in('id', wsIds)
  const wsMap: Record<string, string> = {}
  for (const ws of (workspaces ?? [])) wsMap[ws.id] = ws.name

  // Build short IDs and description lines
  const lines = (tasks ?? []).map((t: Record<string, unknown>) => {
    const wsName: string = wsMap[t.workspace_id as string] ?? ''
    const initials = wsName.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').join('').slice(0, 3)
    const shortId = t.task_number ? `${initials}${String(t.task_number).padStart(3, '0')}` : ''
    return shortId ? `${shortId} · ${t.title}` : String(t.title)
  })

  const count = lines.length
  const titleText = count === 1 ? '1 Task shared with you' : `${count} Tasks shared with you`
  const descText = lines.join('\n')
  const appUrl = `/tasks?ids=${taskIds.join(',')}`
  const origin = c.req.header('origin') ?? ORIGIN

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${titleText}</title>
  <meta property="og:title" content="${titleText}" />
  <meta property="og:description" content="${descText.replace(/"/g, '&quot;')}" />
  <meta property="og:url" content="${origin}${appUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${titleText}" />
  <meta name="twitter:description" content="${descText.replace(/"/g, '&quot;')}" />
  <meta http-equiv="refresh" content="0;url=${appUrl}" />
</head>
<body>
  <p style="font-family:sans-serif;padding:2rem">${lines.map((l: string) => `<strong>${l}</strong>`).join('<br/>')}</p>
  <script>location.replace('${appUrl}')</script>
</body>
</html>`

  return c.html(html)
})

// ── API Routes ────────────────────────────────────────────────────────────────

app.route('/api/workspaces', workspacesRouter)
app.route('/api/pages', pagesRouter)
app.route('/api/blocks', blocksRouter)
app.route('/api/databases', databasesRouter)
app.route('/api/tasks', tasksRouter)
app.route('/api/audio', audioRouter)
app.route('/api/agent', agentRouter)
app.route('/api/settings', settingsRouter)
app.route('/api/users', usersRouter)
app.route('/api/groups', groupsRouter)
app.route('/api/admin/config', configMatrixRouter)
app.route('/api/chat', chatRouter)

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
  // Load config cache from DB
  await loadConfigCache()

  // Create Node HTTP server
  const httpServer = createServer()

  // Attach Hono to HTTP server
  httpServer.on('request', (req, res) => {
    // @ts-expect-error hono/node-server internals
    app.fetch(req, { incoming: req, outgoing: res })
  })

  // Use @hono/node-server's serve instead
  const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`\n✓ ListFlow server running on http://localhost:${info.port}`)
    console.log(`  Health: http://localhost:${info.port}/health`)
    console.log(`  WS:     ws://localhost:${info.port}/ws`)
    console.log(`  Mode:   ${process.env.NO_AUTH === 'true' ? 'NO_AUTH (dev)' : 'auth required'}`)
  })

  // Attach WebSocket server to the HTTP server
  initWss(server as unknown as import('http').Server)
}

main().catch((err) => {
  console.error('Failed to start listflow server:', err)
  process.exit(1)
})
