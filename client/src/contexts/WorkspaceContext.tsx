import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { workspaces, type Workspace } from '@/lib/api'

// Distinct accent palettes — hue chosen so each feels clearly different
const WORKSPACE_PALETTES = [
  { color: '#007AFF', light: 'rgba(0,122,255,0.12)',   name: 'blue' },
  { color: '#34C759', light: 'rgba(52,199,89,0.12)',   name: 'green' },
  { color: '#FF9500', light: 'rgba(255,149,0,0.12)',   name: 'orange' },
  { color: '#AF52DE', light: 'rgba(175,82,222,0.12)',  name: 'purple' },
  { color: '#FF3B30', light: 'rgba(255,59,48,0.12)',   name: 'red' },
  { color: '#30B0C7', light: 'rgba(48,176,199,0.12)',  name: 'teal' },
  { color: '#5856D6', light: 'rgba(88,86,214,0.12)',   name: 'indigo' },
  { color: '#FF2D55', light: 'rgba(255,45,85,0.12)',   name: 'pink' },
]

export function workspacePalette(ws: Workspace | null) {
  if (!ws) return WORKSPACE_PALETTES[0]
  // Subfolders share the colour of their parent so the workspace feels unified
  const seed = ws.parent_id ?? ws.id
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return WORKSPACE_PALETTES[hash % WORKSPACE_PALETTES.length]
}

export interface WorkspaceNode extends Workspace {
  children: WorkspaceNode[]
}

/** Build a forest (list of root nodes with nested children) from a flat list */
export function buildWorkspaceTree(list: Workspace[]): WorkspaceNode[] {
  const map = new Map<string, WorkspaceNode>()
  list.forEach(ws => map.set(ws.id, { ...ws, children: [] }))
  const roots: WorkspaceNode[] = []
  list.forEach(ws => {
    const node = map.get(ws.id)!
    if (ws.parent_id && map.has(ws.parent_id)) {
      map.get(ws.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

/** Collect all descendant IDs (not including the root itself) */
export function getDescendantIds(wsId: string, list: Workspace[]): string[] {
  const result: string[] = []
  const queue = [wsId]
  while (queue.length) {
    const current = queue.shift()!
    const children = list.filter(w => w.parent_id === current)
    children.forEach(c => { result.push(c.id); queue.push(c.id) })
  }
  return result
}

interface WorkspaceContextValue {
  workspaceList: Workspace[]
  workspaceTree: WorkspaceNode[]
  activeWorkspace: Workspace | null
  setActiveWorkspace: (w: Workspace) => void
  loading: boolean
  reload: () => Promise<void>
  createWorkspace: (name: string, type?: 'personal' | 'group') => Promise<Workspace>
  createFolder: (name: string, parentId: string) => Promise<Workspace>
  deleteWorkspace: (id: string) => Promise<void>
  /** IDs of all subfolders under the active workspace (empty if none) */
  activeDescendantIds: string[]
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>([])
  const [workspaceTree, setWorkspaceTree] = useState<WorkspaceNode[]>([])
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null)
  const [activeDescendantIds, setActiveDescendantIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const initialised = useRef(false)

  const reload = useCallback(async () => {
    try {
      const { workspaces: list } = await workspaces.list()
      setWorkspaceList(list)
      setWorkspaceTree(buildWorkspaceTree(list))

      if (!initialised.current) {
        // First load — restore from localStorage or pick first
        const savedId = localStorage.getItem('listflow_workspace')
        const found = list.find(w => w.id === savedId) ?? list[0] ?? null
        if (found) setActiveWorkspaceState(found)
        initialised.current = true
      } else {
        // Subsequent reloads — keep active in sync (e.g. after rename/delete)
        setActiveWorkspaceState(prev =>
          prev ? (list.find(w => w.id === prev.id) ?? list[0] ?? null) : (list[0] ?? null)
        )
      }
    } catch (e) {
      console.error('[workspace] Failed to load:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  // Recompute descendant IDs whenever active workspace or list changes
  useEffect(() => {
    if (!activeWorkspace) { setActiveDescendantIds([]); return }
    setActiveDescendantIds(getDescendantIds(activeWorkspace.id, workspaceList))
  }, [activeWorkspace, workspaceList])

  const setActiveWorkspace = useCallback((w: Workspace) => {
    setActiveWorkspaceState(w)
    localStorage.setItem('listflow_workspace', w.id)
  }, [])

  const createWorkspace = useCallback(async (name: string, type: 'personal' | 'group' = 'personal') => {
    const ws = await workspaces.create({ name, type })
    await reload()
    setActiveWorkspace(ws)
    return ws
  }, [reload, setActiveWorkspace])

  const createFolder = useCallback(async (name: string, parentId: string) => {
    const parent = workspaceList.find(w => w.id === parentId)
    const ws = await workspaces.create({ name, type: parent?.type ?? 'personal', parent_id: parentId })
    await reload()
    setActiveWorkspace(ws)
    return ws
  }, [workspaceList, reload, setActiveWorkspace])

  const deleteWorkspace = useCallback(async (id: string) => {
    await workspaces.delete(id)
    await reload()
  }, [reload])

  return (
    <WorkspaceContext.Provider value={{ workspaceList, workspaceTree, activeWorkspace, setActiveWorkspace, loading, reload, createWorkspace, createFolder, deleteWorkspace, activeDescendantIds }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
