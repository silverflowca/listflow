import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { workspaces, type Workspace } from '@/lib/api'

interface WorkspaceContextValue {
  workspaceList: Workspace[]
  activeWorkspace: Workspace | null
  setActiveWorkspace: (w: Workspace) => void
  loading: boolean
  reload: () => Promise<void>
  createWorkspace: (name: string, type?: 'personal' | 'group') => Promise<Workspace>
  deleteWorkspace: (id: string) => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>([])
  const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null)
  const [loading, setLoading] = useState(true)
  const initialised = useRef(false)

  const reload = useCallback(async () => {
    try {
      const { workspaces: list } = await workspaces.list()
      setWorkspaceList(list)

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

  const deleteWorkspace = useCallback(async (id: string) => {
    await workspaces.delete(id)
    await reload()
  }, [reload])

  return (
    <WorkspaceContext.Provider value={{ workspaceList, activeWorkspace, setActiveWorkspace, loading, reload, createWorkspace, deleteWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider')
  return ctx
}
