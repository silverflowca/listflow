import { useCallback, useEffect, useRef, useState } from 'react'

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

type Handler = (event: LfWsEvent) => void

export function useWs() {
  const wsRef = useRef<WebSocket | null>(null)
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map())
  const unmountingRef = useRef(false)
  const [connected, setConnected] = useState(false)

  const subscribe = useCallback((type: LfWsEventType, handler: Handler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set())
    }
    handlersRef.current.get(type)!.add(handler)
    return () => {
      handlersRef.current.get(type)?.delete(handler)
    }
  }, [])

  const connect = useCallback(() => {
    // Production: same host/port as the page (nginx proxies /ws → node)
    // Dev: Vite dev server proxies /ws → localhost:3016
    const wsUrl = import.meta.env.VITE_WS_URL
      ?? (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws'

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as LfWsEvent
        const handlers = handlersRef.current.get(event.type)
        handlers?.forEach(h => h(event))
      } catch { /* ignore */ }
    }

    ws.onclose = () => {
      if (!unmountingRef.current) {
        setTimeout(connect, 3000)
      }
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    unmountingRef.current = false
    connect()
    return () => {
      unmountingRef.current = true
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [connect])

  return { subscribe, connected }
}
