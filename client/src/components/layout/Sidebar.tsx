import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, FileText, Database, CheckSquare, Mic, Settings,
  ChevronLeft, ChevronRight, Plus, Users, Folder, UsersRound, ShieldCheck, LayoutGrid, HelpCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Avatar } from '@/components/ui/Avatar'
import { HelpModal } from '@/components/ui/HelpModal'

const NAV = [
  { to: '/', icon: Home, label: 'Home', exact: true },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/audio', icon: Mic, label: 'Audio & AI' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

const ADMIN_NAV = [
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/groups', icon: UsersRound, label: 'Groups' },
  { to: '/admin/config', icon: ShieldCheck, label: 'Permissions' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { workspaceList, activeWorkspace, setActiveWorkspace } = useWorkspace()
  const navigate = useNavigate()

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-white border-r border-ios-gray-5 transition-all duration-300',
      collapsed ? 'w-14' : 'w-60',
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-ios-gray-5">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ios-blue rounded-ios flex items-center justify-center">
              <CheckSquare size={14} className="text-white" />
            </div>
            <span className="font-semibold text-ios-label text-sm">ListFlow</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-1.5 rounded-ios hover:bg-ios-gray-6 text-ios-gray-1 transition-colors ml-auto"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Workspace picker */}
      {!collapsed && (
        <div className="px-2 py-2 border-b border-ios-gray-5">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-ios-gray-1 uppercase tracking-wide">Workspaces</span>
            <NavLink to="/workspace" className="text-ios-gray-2 hover:text-ios-blue transition-colors" title="Manage workspaces">
              <LayoutGrid size={13} />
            </NavLink>
          </div>
          {workspaceList.map(ws => (
            <button
              key={ws.id}
              onClick={() => setActiveWorkspace(ws)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-ios text-sm transition-colors',
                activeWorkspace?.id === ws.id
                  ? 'bg-ios-blue/10 text-ios-blue font-medium'
                  : 'text-ios-secondary hover:bg-ios-gray-6',
              )}
            >
              <Avatar name={ws.name} size="sm" />
              <span className="truncate flex-1 text-left">{ws.name}</span>
              {activeWorkspace?.id === ws.id && <span className="text-[10px] text-ios-blue shrink-0">✓</span>}
              {ws.type === 'group' && activeWorkspace?.id !== ws.id && (
                <Users size={11} className="ml-auto text-ios-gray-2 shrink-0" />
              )}
            </button>
          ))}
          <NavLink
            to="/workspace"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-ios text-sm text-ios-gray-1 hover:bg-ios-gray-6 transition-colors"
          >
            <Plus size={14} />
            <span>Add Workspace</span>
          </NavLink>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-2 py-2 rounded-ios text-sm transition-colors',
              isActive
                ? 'bg-ios-blue/10 text-ios-blue font-medium'
                : 'text-ios-secondary hover:bg-ios-gray-6',
            )}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* Pages section */}
        {!collapsed && activeWorkspace && (
          <div className="mt-3">
            <div className="text-xs font-medium text-ios-gray-1 px-2 py-1 uppercase tracking-wide flex items-center justify-between">
              <span>Pages</span>
              <NavLink to="/pages/new" className="hover:text-ios-blue transition-colors">
                <Plus size={12} />
              </NavLink>
            </div>
            <NavLink
              to="/pages"
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-2 py-1.5 rounded-ios text-sm transition-colors',
                isActive ? 'bg-ios-blue/10 text-ios-blue' : 'text-ios-secondary hover:bg-ios-gray-6',
              )}
            >
              <Folder size={16} />
              <span>All Pages</span>
            </NavLink>
          </div>
        )}

        {/* Admin section */}
        <div className="mt-3">
          {!collapsed && (
            <div className="text-xs font-medium text-ios-gray-1 px-2 py-1 uppercase tracking-wide">Admin</div>
          )}
          {ADMIN_NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-2 py-2 rounded-ios text-sm transition-colors',
                isActive
                  ? 'bg-purple-100/60 text-purple-700 font-medium'
                  : 'text-ios-secondary hover:bg-ios-gray-6',
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className={cn('px-2 py-2 border-t border-ios-gray-5', !collapsed && activeWorkspace ? 'pb-1' : '')}>
        <button
          onClick={() => setHelpOpen(true)}
          className={cn(
            'flex items-center gap-3 px-2 py-2 rounded-ios text-sm transition-colors w-full',
            'text-ios-secondary hover:bg-ios-gray-6',
          )}
          title="Help & Instructions"
        >
          <HelpCircle size={18} className="shrink-0 text-ios-gray-1" />
          {!collapsed && <span>Help</span>}
        </button>
        {!collapsed && activeWorkspace && (
          <div className="px-2 pt-1 pb-1">
            <div className="text-xs text-ios-gray-1 truncate">{activeWorkspace.name}</div>
            <div className="text-xs text-ios-gray-2 capitalize">{activeWorkspace.type}</div>
          </div>
        )}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </aside>
  )
}
