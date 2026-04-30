import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { createServer } from 'http'

import { loadConfigCache } from './lib/config.js'
import { initWss } from './lib/ws.js'

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
