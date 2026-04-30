import React, { useEffect, useState } from 'react'
import { Users, Plus, Trash2, Check, Pencil } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { workspaces as workspacesApi, type Workspace } from '@/lib/api'

export function WorkspacePage() {
  const { workspaceList, activeWorkspace, setActiveWorkspace, createWorkspace, deleteWorkspace, reload } = useWorkspace()
  const [createOpen, setCreateOpen] = useState(false)
  const [editWs, setEditWs] = useState<Workspace | null>(null)

  async function handleDelete(ws: Workspace) {
    if (!confirm(`Delete workspace "${ws.name}"? This cannot be undone.`)) return
    await deleteWorkspace(ws.id)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Workspaces"
        subtitle="Manage your workspaces"
        accentColor="#2e7d32"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New Workspace
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-3 max-w-2xl">
        {workspaceList.length === 0 && (
          <div className="text-center py-12 text-ios-gray-3">
            <p className="text-sm">No workspaces yet. Create one to get started.</p>
          </div>
        )}

        {workspaceList.map(ws => (
          <WorkspaceCard
            key={ws.id}
            workspace={ws}
            isActive={activeWorkspace?.id === ws.id}
            onSelect={() => setActiveWorkspace(ws)}
            onEdit={() => setEditWs(ws)}
            onDelete={() => handleDelete(ws)}
          />
        ))}
      </div>

      {createOpen && (
        <CreateWorkspaceModal
          onClose={() => setCreateOpen(false)}
          onCreate={async (name, type) => {
            await createWorkspace(name, type)
            setCreateOpen(false)
          }}
        />
      )}

      {editWs && (
        <EditWorkspaceModal
          workspace={editWs}
          onClose={() => setEditWs(null)}
          onSaved={() => { setEditWs(null); reload() }}
        />
      )}
    </div>
  )
}

// ── Workspace card ─────────────────────────────────────────────────────────────

function WorkspaceCard({ workspace: ws, isActive, onSelect, onEdit, onDelete }: {
  workspace: Workspace
  isActive: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [members, setMembers] = useState<{ user_id: string; role: string }[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!expanded) return
    workspacesApi.members.list(ws.id)
      .then(({ members: m }) => setMembers(m))
      .catch(() => {})
  }, [expanded, ws.id])

  return (
    <Card className={isActive ? 'ring-2 ring-[#2e7d32]/40' : ''}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-ios-gray-6/30 transition-colors rounded-t-ios-lg"
        onClick={() => { onSelect(); setExpanded(e => !e) }}
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 transition-colors"
          style={{ backgroundColor: isActive ? '#2e7d32' : '#8e8e93' }}
        >
          {ws.icon ?? ws.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ios-label text-sm truncate">{ws.name}</span>
            {isActive && (
              <span className="flex items-center gap-0.5 text-xs text-[#2e7d32] font-medium">
                <Check size={11} /> Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-ios-gray-3">
            <span className="capitalize">{ws.type}</span>
            {ws.description && <span className="truncate">· {ws.description}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 text-ios-gray-2 hover:text-ios-blue hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 text-ios-gray-2 hover:text-ios-red hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <span className="text-ios-gray-3 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Expanded members */}
      {expanded && (
        <div className="border-t border-ios-gray-6 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-ios-gray-2">
            <Users size={12} /> Members
          </div>
          {members.length === 0 ? (
            <p className="text-xs text-ios-gray-3">No members</p>
          ) : (
            <ul className="space-y-1.5">
              {members.map(m => (
                <li key={m.user_id} className="flex items-center gap-2">
                  <Avatar name={m.user_id.slice(0, 4)} size="sm" />
                  <span className="flex-1 truncate text-xs text-ios-gray-2 font-mono">{m.user_id}</span>
                  <span className="text-xs text-ios-gray-3 capitalize">{m.role}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ios-gray-3 mt-2">
            Created {new Date(ws.created_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </Card>
  )
}

// ── Create workspace modal ─────────────────────────────────────────────────────

function CreateWorkspaceModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (name: string, type: 'personal' | 'group') => Promise<void>
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'personal' | 'group'>('personal')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErr('Name is required')
    setSaving(true)
    try {
      await onCreate(name.trim(), type)
    } catch (ex: any) {
      setErr(ex.message)
      setSaving(false)
    }
  }

  return (
    <Modal open={true} title="New Workspace" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="text-sm text-ios-red bg-red-50 p-2 rounded-lg">{err}</p>}
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Name *</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. My Projects"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Type</label>
          <div className="flex gap-2">
            {(['personal', 'group'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={
                  `flex-1 py-2 text-sm rounded-xl border-2 capitalize transition-colors ` +
                  (type === t
                    ? 'border-ios-blue bg-blue-50 text-ios-blue font-medium'
                    : 'border-ios-gray-5 text-ios-gray-2 hover:border-ios-gray-3')
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit workspace modal ───────────────────────────────────────────────────────

function EditWorkspaceModal({ workspace, onClose, onSaved }: {
  workspace: Workspace
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description ?? '')
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await workspacesApi.update(workspace.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} title="Edit Workspace" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Description</label>
          <Input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}
