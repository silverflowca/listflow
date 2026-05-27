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

// Helper: compute initials from workspace name (same logic as client taskShortId)
function wsInitials(name: string): string {
  return name.trim().split(/\s+/).map((w: string) => w[0]?.toUpperCase() ?? '').join('').slice(0, 3)
}

// Short ID pattern: 1-3 uppercase letters followed by digits (e.g. KDT042, AB7)
const SHORT_ID_RE = /^[A-Z]{1,3}\d+$/

app.get('/share', async (c) => {
  const rawIds = c.req.query('ids') ?? ''
  const params = rawIds.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10)

  if (params.length === 0) {
    return c.html('<!DOCTYPE html><html><head><title>ListFlow</title></head><body><script>location.replace(\'/\')</script></body></html>')
  }

  // Resolve short IDs (e.g. KDT042) to UUIDs if needed
  let tasks: Record<string, unknown>[] = []

  const shortParams = params.filter(p => SHORT_ID_RE.test(p))
  const uuidParams  = params.filter(p => !SHORT_ID_RE.test(p))

  if (shortParams.length > 0) {
    // Need all workspaces to match initials, then filter by task_number
    const { data: allWs } = await (lf('workspaces') as any).select('id, name')
    const wsAll: { id: string; name: string }[] = allWs ?? []

    // Build lookup: initials → workspace IDs
    const initialsMap: Record<string, string[]> = {}
    for (const ws of wsAll) {
      const init = wsInitials(ws.name)
      if (!initialsMap[init]) initialsMap[init] = []
      initialsMap[init].push(ws.id)
    }

    // Parse each short ID into { initials, taskNumber }
    const lookups = shortParams.map(p => {
      const match = p.match(/^([A-Z]{1,3})(\d+)$/)!
      return { shortId: p, initials: match[1], taskNumber: parseInt(match[2]) }
    })

    // Fetch matching tasks by (workspace_id IN [...], task_number IN [...])
    const allInitials = [...new Set(lookups.map(l => l.initials))]
    const wsIdsForLookup = allInitials.flatMap(init => initialsMap[init] ?? [])

    if (wsIdsForLookup.length > 0) {
      const allNumbers = lookups.map(l => l.taskNumber)
      const { data: found } = await (lf('tasks') as any)
        .select('id, title, task_number, workspace_id')
        .in('workspace_id', wsIdsForLookup)
        .in('task_number', allNumbers)

      // Filter to only tasks whose (initials+number) matches a requested short ID
      for (const t of (found ?? []) as Record<string, unknown>[]) {
        const ws = wsAll.find((w: { id: string }) => w.id === t.workspace_id)
        if (!ws) continue
        const computed = `${wsInitials(ws.name)}${String(t.task_number).padStart(0, '')}`
        // Match loosely: initials + task_number (number without padding)
        const init = wsInitials(ws.name)
        const num = t.task_number as number
        if (lookups.some(l => l.initials === init && l.taskNumber === num)) {
          tasks.push(t)
        }
      }
    }
  }

  if (uuidParams.length > 0) {
    const { data: found } = await (lf('tasks') as any)
      .select('id, title, task_number, workspace_id')
      .in('id', uuidParams)
    tasks = [...tasks, ...(found ?? [])]
  }

  // Fetch workspace names
  const wsIds = [...new Set(tasks.map(t => t.workspace_id as string))]
  let wsMap: Record<string, string> = {}
  if (wsIds.length > 0) {
    const { data: workspaces } = await (lf('workspaces') as any).select('id, name').in('id', wsIds)
    for (const ws of (workspaces ?? [])) wsMap[ws.id] = ws.name
  }

  // Build display lines + short IDs for redirect
  const taskShortIds: string[] = []
  const lines = tasks.map((t: Record<string, unknown>) => {
    const wsName: string = wsMap[t.workspace_id as string] ?? ''
    const initials = wsInitials(wsName)
    const shortId = t.task_number ? `${initials}${String(t.task_number).padStart(3, '0')}` : ''
    taskShortIds.push(shortId || (t.id as string))
    return shortId ? `${shortId} · ${t.title}` : String(t.title)
  })

  const count = lines.length
  const titleText = count === 1 ? '1 Task shared with you' : `${count} Tasks shared with you`
  const descText = lines.join('\n')
  // Redirect uses short IDs so the app URL is also clean
  const appUrl = `/tasks?ids=${taskShortIds.join(',')}`
  const origin = c.req.header('origin') ?? ORIGIN

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${titleText}</title>
  <meta property="og:title" content="${titleText}" />
  <meta property="og:description" content="${descText.replace(/"/g, '&quot;')}" />
  <meta property="og:url" content="${origin}/share?ids=${params.join(',')}" />
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
