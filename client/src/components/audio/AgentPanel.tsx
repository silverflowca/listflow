import React, { useEffect, useState } from 'react'
import { Bot, CheckCircle, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useWs, type LfWsEvent } from '@/hooks/useWs'
import type { AgentRun, Task } from '@/lib/api'
import { tasks as tasksApi } from '@/lib/api'

interface AgentPanelProps {
  runId: string
  onTasksCreated?: (tasks: Task[]) => void
}

interface AgentMessage {
  type: 'thinking' | 'tool' | 'done' | 'error'
  text: string
  timestamp: string
}

export function AgentPanel({ runId, onTasksCreated }: AgentPanelProps) {
  const { subscribe } = useWs()
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [status, setStatus] = useState<'running' | 'done' | 'failed'>('running')
  const [tasksCreated, setTasksCreated] = useState<string[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const unsubs = [
      subscribe('agent.thinking', (evt) => {
        const { runId: rid, iteration, thought } = evt.payload as { runId: string; iteration: number; thought: string }
        if (rid !== runId) return
        setMessages(prev => [...prev, { type: 'thinking', text: thought, timestamp: evt.timestamp }])
      }),
      subscribe('agent.tool_called', (evt) => {
        const { runId: rid, toolName, ok } = evt.payload as { runId: string; toolName: string; ok: boolean }
        if (rid !== runId) return
        setMessages(prev => [...prev, {
          type: 'tool',
          text: `${ok ? '✓' : '✗'} ${toolName}`,
          timestamp: evt.timestamp,
        }])
      }),
      subscribe('agent.done', (evt) => {
        const { runId: rid, response, tasksCreated: tc } = evt.payload as { runId: string; response: string; tasksCreated: string[] }
        if (rid !== runId) return
        setStatus('done')
        setSummary(response)
        setTasksCreated(tc)
      }),
      subscribe('agent.failed', (evt) => {
        const { runId: rid, error } = evt.payload as { runId: string; error: string }
        if (rid !== runId) return
        setStatus('failed')
        setMessages(prev => [...prev, { type: 'error', text: error, timestamp: evt.timestamp }])
      }),
    ]
    return () => unsubs.forEach(u => u())
  }, [runId, subscribe])

  return (
    <div className="bg-white rounded-ios-lg shadow-ios border border-ios-gray-5 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-ios-gray-6 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <Bot size={16} className="text-ios-purple shrink-0" />
        <span className="text-sm font-medium text-ios-label flex-1">AI Agent</span>
        {status === 'running' && <Loader2 size={14} className="text-ios-blue animate-spin" />}
        {status === 'done' && <CheckCircle size={14} className="text-ios-green" />}
        {status === 'failed' && <AlertCircle size={14} className="text-ios-red" />}
        {expanded ? <ChevronUp size={14} className="text-ios-gray-1" /> : <ChevronDown size={14} className="text-ios-gray-1" />}
      </div>

      {expanded && (
        <div className="border-t border-ios-gray-5">
          {/* Messages */}
          {messages.length > 0 && (
            <div className="px-4 py-2 max-h-40 overflow-y-auto space-y-1">
              {messages.map((msg, i) => (
                <div key={i} className={`text-xs ${msg.type === 'error' ? 'text-ios-red' : msg.type === 'tool' ? 'text-ios-blue font-mono' : 'text-ios-gray-1'}`}>
                  {msg.text}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div className="px-4 py-3 border-t border-ios-gray-5 bg-ios-gray-6">
              <p className="text-xs font-medium text-ios-gray-1 mb-1">Summary</p>
              <p className="text-sm text-ios-label">{summary}</p>
            </div>
          )}

          {/* Tasks created */}
          {tasksCreated.length > 0 && (
            <div className="px-4 py-2 border-t border-ios-gray-5">
              <p className="text-xs text-ios-green font-medium">
                ✓ Created {tasksCreated.length} task{tasksCreated.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {status === 'running' && messages.length === 0 && (
            <div className="px-4 py-3 text-xs text-ios-gray-1 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Processing transcript…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
