import React, { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/users/UserAvatar'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { UserSelect } from '@/components/users/UserSelect'
import { groups as groupsApi, users as usersApi } from '@/lib/api'
import type { UserGroup, AppUser } from '@/lib/api'

const FAKE_USER_ID = '00000000-0000-0000-0000-000000000000'

const GROUP_COLORS = ['#5e3aa0', '#1e5799', '#2e7d32', '#c62828', '#e65100', '#00838f', '#4527a0']

export function GroupsPage() {
  const [list, setList] = useState<UserGroup[]>([])
  const [allUsers, setAllUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [{ groups }, { users }] = await Promise.all([groupsApi.list(), usersApi.list()])
      setList(groups)
      setAllUsers(users)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    if (!confirm('Delete this group?')) return
    await groupsApi.delete(id)
    setList(prev => prev.filter(g => g.id !== id))
  }

  async function handleRemoveMember(groupId: string, userId: string) {
    await groupsApi.members.remove(groupId, userId)
    setList(prev => prev.map(g => g.id !== groupId ? g : {
      ...g, members: g.members?.filter(m => m.user_id !== userId)
    }))
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Groups"
        subtitle="Organise users into teams"
        accentColor="#1e5799"
        actions={<Button size="sm" onClick={() => setAddOpen(true)}>+ New Group</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-ios-gray-3">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-sm">No groups yet. Create one to organise your team.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                allUsers={allUsers}
                expanded={expanded === group.id}
                onToggle={() => setExpanded(expanded === group.id ? null : group.id)}
                onDelete={() => handleDelete(group.id)}
                onAddMember={() => setAddMemberGroupId(group.id)}
                onRemoveMember={(uid) => handleRemoveMember(group.id, uid)}
              />
            ))}
          </div>
        )}
      </div>

      {addOpen && (
        <CreateGroupModal
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); load() }}
        />
      )}

      {addMemberGroupId && (
        <AddMemberModal
          groupId={addMemberGroupId}
          allUsers={allUsers}
          existingMemberIds={list.find(g => g.id === addMemberGroupId)?.members?.map(m => m.user_id) ?? []}
          onClose={() => setAddMemberGroupId(null)}
          onAdded={() => { setAddMemberGroupId(null); load() }}
        />
      )}
    </div>
  )
}

// ── Group Card ─────────────────────────────────────────────────────────────────

function GroupCard({ group, allUsers, expanded, onToggle, onDelete, onAddMember, onRemoveMember }: {
  group: UserGroup; allUsers: AppUser[]; expanded: boolean
  onToggle: () => void; onDelete: () => void; onAddMember: () => void
  onRemoveMember: (uid: string) => void
}) {
  const memberCount = group.members?.length ?? 0

  return (
    <div className="bg-white rounded-xl border border-ios-gray-5 overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-ios-gray-6/50 transition-colors"
        onClick={onToggle}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-base flex-shrink-0"
          style={{ backgroundColor: group.color }}
        >
          {group.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-ios-label">{group.name}</div>
          {group.description && <div className="text-xs text-ios-gray-3 truncate">{group.description}</div>}
        </div>
        <span className="text-xs text-ios-gray-3 mr-2">{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
        <span className="text-ios-gray-3 text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded members */}
      {expanded && (
        <div className="border-t border-ios-gray-6 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-ios-gray-2">Members</span>
            <button onClick={onAddMember} className="text-xs text-ios-blue hover:underline">+ Add member</button>
          </div>
          {(group.members ?? []).length === 0 ? (
            <p className="text-xs text-ios-gray-3 py-1">No members yet</p>
          ) : (
            <ul className="space-y-1.5">
              {(group.members ?? []).map(m => {
                const user = allUsers.find(u => u.id === m.user_id)
                if (!user) return null
                return (
                  <li key={m.id} className="flex items-center gap-2.5">
                    <UserAvatar user={user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{user.name}</span>
                      <span className="ml-2 text-xs text-ios-gray-3">{m.role}</span>
                    </div>
                    <button onClick={() => onRemoveMember(user.id)} className="text-xs text-ios-gray-3 hover:text-ios-red">✕</button>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex justify-end mt-3">
            <button onClick={onDelete} className="text-xs text-ios-gray-3 hover:text-ios-red transition-colors">Delete group</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Create Group Modal ─────────────────────────────────────────────────────────

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', color: '#5e3aa0', icon: '👥' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return setErr('Name is required')
    setSaving(true)
    try {
      await groupsApi.create({ ...form, createdBy: FAKE_USER_ID })
      onCreated()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} title="New Group" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="text-sm text-ios-red bg-red-50 p-2 rounded-lg">{err}</p>}
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Name *</label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Leadership Team" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Description</label>
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-ios-gray-2 mb-1">Icon</label>
            <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="👥" maxLength={2} />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-ios-gray-2 mb-1">Color</label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {GROUP_COLORS.map(c => (
                <button
                  key={c} type="button"
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-6 h-6 rounded-full ring-offset-1 transition-all"
                  style={{ backgroundColor: c, outline: form.color === c ? `2px solid ${c}` : undefined }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Add Member Modal ───────────────────────────────────────────────────────────

function AddMemberModal({ groupId, allUsers, existingMemberIds, onClose, onAdded }: {
  groupId: string; allUsers: AppUser[]; existingMemberIds: string[]
  onClose: () => void; onAdded: () => void
}) {
  const eligible = allUsers.filter(u => !existingMemberIds.includes(u.id))
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (selected.length === 0) return
    setSaving(true)
    try {
      await Promise.all(selected.map(uid => groupsApi.members.add(groupId, { userId: uid })))
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} title="Add Members" onClose={onClose}>
      <div className="space-y-4">
        <UserSelect users={eligible} value={selected} onChange={setSelected} multi placeholder="Pick users to add…" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || selected.length === 0}>
            {saving ? 'Adding…' : `Add ${selected.length > 0 ? selected.length : ''} Member${selected.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
