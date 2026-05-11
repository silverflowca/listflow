import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Plus, Trash2, Check, Pencil, FileText, CheckSquare, Mic, ChevronDown, ChevronUp } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useWorkspace, workspacePalette } from '@/contexts/WorkspaceContext'
import { workspaces as workspacesApi, pages, tasks, audio, users as usersApi, type Workspace } from '@/lib/api'

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
        accentColor="var(--ws-color)"
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
  const [expanded, setExpanded] = useState(false)
  const [ownerName, setOwnerName] = useState<string | null>(null)
  const [counts, setCounts] = useState<{ pages: number; tasks: number; recordings: number } | null>(null)

  const palette = workspacePalette(ws)

  // Load owner name once
  useEffect(() => {
    if (!ws.owner_id) return
    usersApi.get(ws.owner_id)
      .then(u => setOwnerName(u.name || u.email))
      .catch(() => setOwnerName(ws.owner_id.slice(0, 8) + '…'))
  }, [ws.owner_id])

  // Load counts when expanded
  useEffect(() => {
    if (!expanded || counts) return
    Promise.all([
      pages.list(ws.id).then(r => r.pages.length).catch(() => 0),
      tasks.list({ workspaceId: ws.id }).then(r => r.tasks.length).catch(() => 0),
      audio.list(ws.id).then(r => r.recordings.length).catch(() => 0),
    ]).then(([p, t, a]) => setCounts({ pages: p, tasks: t, recordings: a }))
  }, [expanded, ws.id, counts])

  return (
    <Card className={isActive ? 'ring-2' : ''} style={isActive ? { '--tw-ring-color': palette.color } as React.CSSProperties : {}}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-ios-gray-6/30 transition-colors rounded-t-ios-lg"
        onClick={() => { onSelect(); setExpanded(e => !e) }}
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base flex-shrink-0 transition-colors duration-300"
          style={{ backgroundColor: palette.color }}
        >
          {ws.icon ?? ws.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ios-label text-sm truncate">{ws.name}</span>
            {isActive && (
              <span className="flex items-center gap-0.5 text-xs font-medium" style={{ color: palette.color }}>
                <Check size={11} /> Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-ios-gray-3">
            <span className="capitalize">{ws.type}</span>
            {ownerName && <span>· Owner: <span className="text-ios-gray-2 font-medium">{ownerName}</span></span>}
            {ws.description && <span className="truncate">· {ws.description}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onEdit() }}
            className="p-1.5 text-ios-gray-2 hover:bg-ios-gray-6 rounded-lg transition-colors"
            style={{ ['--hover-color' as any]: palette.color }}
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
          {expanded
            ? <ChevronUp size={14} className="text-ios-gray-3 ml-1" />
            : <ChevronDown size={14} className="text-ios-gray-3 ml-1" />
          }
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-ios-gray-5 px-4 py-3 space-y-3">

          {/* Quick-link counts */}
          <div className="grid grid-cols-3 gap-2">
            <Link
              to="/pages"
              onClick={onSelect}
              className="flex flex-col items-center gap-1 p-2 rounded-ios hover:bg-ios-gray-6 transition-colors group"
            >
              <FileText size={16} style={{ color: palette.color }} />
              <span className="text-sm font-semibold text-ios-label">
                {counts == null ? '—' : counts.pages}
              </span>
              <span className="text-[10px] text-ios-gray-2">Documents</span>
            </Link>
            <Link
              to="/tasks"
              onClick={onSelect}
              className="flex flex-col items-center gap-1 p-2 rounded-ios hover:bg-ios-gray-6 transition-colors group"
            >
              <CheckSquare size={16} style={{ color: palette.color }} />
              <span className="text-sm font-semibold text-ios-label">
                {counts == null ? '—' : counts.tasks}
              </span>
              <span className="text-[10px] text-ios-gray-2">Tasks</span>
            </Link>
            <Link
              to="/audio"
              onClick={onSelect}
              className="flex flex-col items-center gap-1 p-2 rounded-ios hover:bg-ios-gray-6 transition-colors group"
            >
              <Mic size={16} style={{ color: palette.color }} />
              <span className="text-sm font-semibold text-ios-label">
                {counts == null ? '—' : counts.recordings}
              </span>
              <span className="text-[10px] text-ios-gray-2">Recordings</span>
            </Link>
          </div>

          {/* Members */}
          <MembersList workspaceId={ws.id} />

          <p className="text-xs text-ios-gray-3">
            Created {new Date(ws.created_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </Card>
  )
}

function MembersList({ workspaceId }: { workspaceId: string }) {
  const [members, setMembers] = useState<{ user_id: string; role: string }[]>([])
  const [memberNames, setMemberNames] = useState<Record<string, string>>({})

  useEffect(() => {
    workspacesApi.members.list(workspaceId)
      .then(({ members: m }) => {
        setMembers(m)
        // Fetch names for each member
        m.forEach(mem =>
          usersApi.get(mem.user_id)
            .then(u => setMemberNames(prev => ({ ...prev, [mem.user_id]: u.name || u.email })))
            .catch(() => {})
        )
      })
      .catch(() => {})
  }, [workspaceId])

  if (members.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-xs font-medium text-ios-gray-2">
        <Users size={12} /> Members ({members.length})
      </div>
      <ul className="space-y-1">
        {members.map(m => (
          <li key={m.user_id} className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-ios-gray-5 flex items-center justify-center text-[10px] font-medium text-ios-gray-1 flex-shrink-0">
              {(memberNames[m.user_id] ?? m.user_id).charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 truncate text-xs text-ios-label">
              {memberNames[m.user_id] ?? <span className="text-ios-gray-3 font-mono">{m.user_id.slice(0, 8)}…</span>}
            </span>
            <span className="text-xs text-ios-gray-3 capitalize">{m.role}</span>
          </li>
        ))}
      </ul>
    </div>
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
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Projects" autoFocus />
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
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}
