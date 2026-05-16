import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useWorkspace, workspacePalette } from '@/contexts/WorkspaceContext'
import { useAuth } from '@/contexts/AuthContext'
import { useWs } from '@/hooks/useWs'
import type { Task } from '@/lib/api'

interface ToastNotif {
  id: string
  task: Task
  updatedBy: string
}

function NotificationToasts() {
  const { user } = useAuth()
  const { subscribe } = useWs()
  const navigate = useNavigate()
  const [toasts, setToasts] = useState<ToastNotif[]>([])

  useEffect(() => {
    const unsub = subscribe('task.notification', (e) => {
      const { task, updatedBy } = e.payload as { task: Task; updatedBy: string }
      if (!user) return
      // Only show if current user is in notify_user_ids and didn't make the update themselves
      if (!task.notify_user_ids?.includes(user.id)) return
      if (updatedBy === user.id) return
      const notif: ToastNotif = { id: `${task.id}-${Date.now()}`, task, updatedBy }
      setToasts(prev => [...prev.slice(-2), notif]) // max 3 toasts
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== notif.id)), 6000)
    })
    return unsub
  }, [subscribe, user])

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(n => (
        <div
          key={n.id}
          className="pointer-events-auto flex items-start gap-3 bg-white border border-ios-gray-5 rounded-2xl shadow-ios-lg px-4 py-3 max-w-xs animate-fade-in"
        >
          <Bell size={16} className="shrink-0 mt-0.5 text-[var(--ws-color,#007AFF)]" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ios-label">Task updated</p>
            <p className="text-xs text-ios-gray-1 truncate mt-0.5">{n.task.title}</p>
            <button
              onClick={() => { navigate('/tasks'); setToasts(prev => prev.filter(t => t.id !== n.id)) }}
              className="text-[11px] ws-text font-medium mt-1 hover:underline"
            >
              View task →
            </button>
          </div>
          <button
            onClick={() => setToasts(prev => prev.filter(t => t.id !== n.id))}
            className="shrink-0 p-0.5 text-ios-gray-3 hover:text-ios-gray-1 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

export function Layout() {
  const { activeWorkspace } = useWorkspace()
  const palette = workspacePalette(activeWorkspace)

  return (
    <div
      className="flex h-screen bg-ios-bg overflow-hidden"
      style={{
        '--ws-color': palette.color,
        '--ws-color-light': palette.light,
      } as React.CSSProperties}
    >
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
      <NotificationToasts />
    </div>
  )
}
