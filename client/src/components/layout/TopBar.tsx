import React from 'react'
import { useWs } from '@/hooks/useWs'
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

      {/* Title */}
      <div className="pl-3">
        <h1 className="text-base font-semibold text-ios-label leading-tight">{title}</h1>
        {subtitle && <p className="text-xs leading-none mt-0.5" style={{ color: 'var(--ws-color)' }}>{subtitle}</p>}
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {actions}
        <div className={`flex items-center gap-1 text-xs ${connected ? 'text-ios-green' : 'text-ios-gray-2'}`}>
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="hidden sm:block">{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>
    </header>
  )
}
