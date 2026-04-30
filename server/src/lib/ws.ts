import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'

export type LfWsEventType =
  | 'connected'
  | 'task.created'
  | 'task.updated'
  | 'agent.thinking'
  | 'agent.tool_called'
  | 'agent.done'
  | 'agent.failed'
  | 'transcript.ready'
  | 'ping'

export interface LfWsEvent {
  type: LfWsEventType
  payload: Record<string, unknown>
  timestamp: string
}

let _wss: WebSocketServer | null = null

export function initWss(server: Server): WebSocketServer {
  _wss = new WebSocketServer({ server, path: '/ws' })

  _wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', payload: { service: 'listflow' }, timestamp: new Date().toISOString() }))
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as { type: string }
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'ping', payload: {}, timestamp: new Date().toISOString() }))
        }
      } catch { /* ignore */ }
    })
  })

  console.log('[ws] WebSocket server attached to HTTP server at /ws')
  return _wss
}

export function broadcast(event: LfWsEvent): void {
  if (!_wss) return
  const msg = JSON.stringify(event)
  for (const client of _wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg)
    }
  }
}

function emit(type: LfWsEventType, payload: Record<string, unknown>): void {
  broadcast({ type, payload, timestamp: new Date().toISOString() })
}

export const emitTaskCreated = (task: Record<string, unknown>) =>
  emit('task.created', { task })

export const emitTaskUpdated = (task: Record<string, unknown>) =>
  emit('task.updated', { task })

export const emitAgentThinking = (runId: string, iteration: number, thought: string) =>
  emit('agent.thinking', { runId, iteration, thought })

export const emitAgentToolCalled = (runId: string, toolName: string, ok: boolean, result?: unknown) =>
  emit('agent.tool_called', { runId, toolName, ok, result })

export const emitAgentDone = (runId: string, response: string, tasksCreated: string[]) =>
  emit('agent.done', { runId, response, tasksCreated })

export const emitAgentFailed = (runId: string, error: string) =>
  emit('agent.failed', { runId, error })

export const emitTranscriptReady = (recordingId: string, transcriptId: string, rawText: string) =>
  emit('transcript.ready', { recordingId, transcriptId, rawText })
