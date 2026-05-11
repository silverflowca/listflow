import React from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useWorkspace, workspacePalette } from '@/contexts/WorkspaceContext'

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
    </div>
  )
}
