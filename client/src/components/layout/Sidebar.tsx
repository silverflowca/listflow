import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home, FileText, Database, CheckSquare, Mic, Settings,
  ChevronLeft, ChevronRight, Plus, Users, Folder, UsersRound, ShieldCheck, LayoutGrid, HelpCircle, LogOut,
  ChevronDown, ChevronRight as ChevronRightSm, FolderOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace, workspacePalette, type WorkspaceNode } from '@/contexts/WorkspaceContext'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar } from '@/components/ui/Avatar'
import { HelpModal } from '@/components/ui/HelpModal'
import type { Workspace } from '@/lib/api'

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

// ── Recursive workspace tree node ─────────────────────────────────────────────

function WorkspaceTreeNode({
  node,
  depth,
  activeWorkspace,
  setActiveWorkspace,
}: {
  node: WorkspaceNode
  depth: number
  activeWorkspace: Workspace | null
  setActiveWorkspace: (w: Workspace) => void
}) {
  const isActive = activeWorkspace?.id === node.id
  const hasChildren = node.children.length > 0
  const [open, setOpen] = useState(isActive || node.children.some(c => c.id === activeWorkspace?.id))
  const wsPalette = workspacePalette(node)

  return (
    <div>
      <button
        onClick={() => {
          setActiveWorkspace(node)
          if (hasChildren) setOpen(o => !o)
        }}
        className={cn(
          'w-full flex items-center gap-1.5 py-1.5 rounded-ios text-sm transition-colors',
          isActive ? 'font-medium' : 'text-ios-secondary hover:bg-ios-gray-6',
        )}
        style={{
          paddingLeft: `${8 + depth * 12}px`,
          paddingRight: 8,
          ...(isActive ? { backgroundColor: wsPalette.light, color: wsPalette.color } : {}),
        }}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <span className="shrink-0 transition-transform" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            <ChevronDown size={12} />
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Folder icon */}
        {hasChildren
          ? <FolderOpen size={14} className="shrink-0" style={{ color: wsPalette.color }} />
          : <Folder size={14} className="shrink-0" style={{ color: wsPalette.color }} />
        }

        <span className="truncate flex-1 text-left text-xs">{node.name}</span>

        {isActive && <span className="text-[10px] shrink-0" style={{ color: wsPalette.color }}>✓</span>}
        {!isActive && node.type === 'group' && (
          <Users size={10} className="shrink-0 text-ios-gray-2" />
        )}
      </button>

      {/* Children */}
      {hasChildren && open && (
        <div>
          {node.children.map(child => (
            <WorkspaceTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeWorkspace={activeWorkspace}
              setActiveWorkspace={setActiveWorkspace}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const { workspaceTree, activeWorkspace, setActiveWorkspace } = useWorkspace()
  const { user, signOut, isDev } = useAuth()
  const navigate = useNavigate()

  const palette = workspacePalette(activeWorkspace)

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-white border-r border-ios-gray-5 transition-all duration-300',
      collapsed ? 'w-14' : 'w-64',
    )}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-3 border-b border-ios-gray-5 transition-colors duration-300"
        style={{ borderBottomColor: `${palette.color}30` }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-ios flex items-center justify-center transition-colors duration-300"
              style={{ backgroundColor: palette.color }}
            >
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
        <div className="px-2 py-2 border-b border-ios-gray-5 overflow-y-auto max-h-60">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-ios-gray-1 uppercase tracking-wide">Workspaces</span>
            <NavLink to="/workspace" className="text-ios-gray-2 hover:text-ios-blue transition-colors" title="Manage workspaces">
              <LayoutGrid size={13} />
            </NavLink>
          </div>

          {/* Tree */}
          {workspaceTree.map(node => (
            <WorkspaceTreeNode
              key={node.id}
              node={node}
              depth={0}
              activeWorkspace={activeWorkspace}
              setActiveWorkspace={setActiveWorkspace}
            />
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
              isActive ? 'font-medium' : 'text-ios-secondary hover:bg-ios-gray-6',
            )}
            style={({ isActive }) => isActive ? {
              backgroundColor: 'var(--ws-color-light)',
              color: 'var(--ws-color)',
            } : {}}
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
                isActive ? 'font-medium' : 'text-ios-secondary hover:bg-ios-gray-6',
              )}
              style={({ isActive }) => isActive ? {
                backgroundColor: 'var(--ws-color-light)',
                color: 'var(--ws-color)',
              } : {}}
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
      <div
        className="px-2 py-2 border-t border-ios-gray-5 space-y-0.5 transition-colors duration-300"
        style={{ borderTopColor: `${palette.color}30` }}
      >
        {/* Signed-in user */}
        {!collapsed && user && !isDev && (
          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar name={user.email ?? '?'} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-ios-label truncate">
                {user.user_metadata?.name ?? user.email?.split('@')[0]}
              </div>
              <div className="text-[10px] text-ios-gray-2 truncate">{user.email}</div>
            </div>
          </div>
        )}

        {/* Help */}
        <button
          onClick={() => setHelpOpen(true)}
          className="flex items-center gap-3 px-2 py-2 rounded-ios text-sm transition-colors w-full text-ios-secondary hover:bg-ios-gray-6"
          title="Help & Instructions"
        >
          <HelpCircle size={18} className="shrink-0 text-ios-gray-1" />
          {!collapsed && <span>Help</span>}
        </button>

        {/* Sign out */}
        {!isDev && (
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-2 py-2 rounded-ios text-sm transition-colors w-full text-ios-secondary hover:bg-red-50 hover:text-ios-red group"
            title="Sign out"
          >
            <LogOut size={18} className="shrink-0 text-ios-gray-1 group-hover:text-ios-red" />
            {!collapsed && <span>Sign out</span>}
          </button>
        )}

        {/* Active workspace label */}
        {!collapsed && activeWorkspace && (
          <div className="px-2 pt-1 pb-0.5">
            <div className="text-xs font-medium truncate" style={{ color: palette.color }}>{activeWorkspace.name}</div>
            <div className="text-xs text-ios-gray-2 capitalize">{activeWorkspace.type}</div>
          </div>
        )}
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </aside>
  )
}
