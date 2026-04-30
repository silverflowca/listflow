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

export function TopBar({ title, subtitle, accentColor = '#007AFF', actions }: TopBarProps) {
  const { connected } = useWs()

  return (
    <header className="relative flex items-center justify-between px-6 bg-white border-b border-ios-gray-5 h-14 shrink-0 overflow-hidden">
      {/* Coloured left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
        style={{ backgroundColor: accentColor }}
      />

      {/* Title */}
      <div className="pl-3">
        <h1 className="text-base font-semibold text-ios-label leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-ios-gray-3 leading-none mt-0.5">{subtitle}</p>}
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
