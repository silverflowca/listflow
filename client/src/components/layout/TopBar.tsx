import React from 'react'
import { Link } from 'react-router-dom'
import { useWs } from '@/hooks/useWs'
import { useWorkspace, workspacePalette } from '@/contexts/WorkspaceContext'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
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
  const { user } = useAuth()
  const palette = workspacePalette(activeWorkspace)

  const displayName = user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? ''

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

        {/* WS status */}
        <div className={`flex items-center gap-1 text-xs ${connected ? 'text-ios-green' : 'text-ios-gray-2'}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="hidden sm:block">{connected ? 'Live' : 'Offline'}</span>
        </div>

        {/* User avatar chip — links to settings */}
        {user && (
          <Link
            to="/settings"
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-white/70 border border-ios-gray-5 hover:bg-white hover:shadow-sm transition-all"
            title="Account settings"
          >
            <Avatar name={user.email ?? '?'} size="sm" />
            {displayName && (
              <span className="text-xs font-medium text-ios-label hidden sm:block max-w-[100px] truncate">
                {displayName}
              </span>
            )}
          </Link>
        )}
      </div>
    </header>
  )
}
