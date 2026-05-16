import React from 'react'
import { useWs } from '@/hooks/useWs'
import { useWorkspace, workspacePalette } from '@/contexts/WorkspaceContext'
import { Wifi, WifiOff } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle?: string
  /** Left accent bar colour — defaults to ios-blue (#007AFF) */
  accentColor?: string
  actions?: React.ReactNode
}

export function TopBar({ title, subtitle, accentColor, actions }: TopBarProps) {
  const { connected } = useWs()
  const { activeWorkspace } = useWorkspace()
  const palette = workspacePalette(activeWorkspace)

  return (
    <header
      className="relative flex items-center justify-between px-6 h-14 shrink-0 overflow-hidden border-b transition-colors duration-300"
      style={{
        backgroundColor: 'var(--ws-color-light)',
        borderBottomColor: `var(--ws-color)`,
      }}
    >
      {/* Coloured left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-r"
        style={{ backgroundColor: 'var(--ws-color)' }}
      />

      {/* Left: workspace badge + title */}
      <div className="pl-3 flex items-center gap-3 min-w-0">
        {activeWorkspace && (
          <div
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white text-xs font-semibold leading-none"
            style={{ backgroundColor: palette.color }}
          >
            {activeWorkspace.icon && <span>{activeWorkspace.icon}</span>}
            <span className="truncate max-w-[120px]">{activeWorkspace.name}</span>
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-base font-semibold text-ios-label leading-tight">{title}</h1>
          {subtitle && <p className="text-xs leading-none mt-0.5" style={{ color: 'var(--ws-color)' }}>{subtitle}</p>}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 shrink-0">
        {actions}
        <div className={`flex items-center gap-1 text-xs ${connected ? 'text-ios-green' : 'text-ios-gray-2'}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="hidden sm:block">{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>
    </header>
  )
}
