import React, { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { UserAvatar } from '@/components/users/UserAvatar'
import { RoleBadge, StatusBadge } from '@/components/users/RoleBadge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { users as usersApi } from '@/lib/api'
import type { AppUser, AppRole } from '@/lib/api'

const ROLES: AppRole[] = ['admin', 'manager', 'member', 'viewer', 'guest']

export function UsersPage() {
  const [list, setList] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editUser, setEditUser] = useState<AppUser | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { users } = await usersApi.list()
      setList(users)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleRoleChange(user: AppUser, role: AppRole) {
    await usersApi.update(user.id, { role })
    setList(prev => prev.map(u => u.id === user.id ? { ...u, role } : u))
  }

  async function handleDeactivate(user: AppUser) {
    const next = user.status === 'active' ? 'suspended' : 'active'
    await usersApi.update(user.id, { status: next })
    setList(prev => prev.map(u => u.id === user.id ? { ...u, status: next } : u))
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Users"
        subtitle="Manage team members and roles"
        accentColor="#5e3aa0"
        actions={<Button size="sm" onClick={() => setAddOpen(true)}>+ Add User</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && <div className="mb-4 text-sm text-ios-red bg-red-50 p-3 rounded-lg">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="bg-white rounded-xl border border-ios-gray-5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ios-gray-6 bg-ios-gray-6/50">
                  <th className="text-left px-4 py-3 font-medium text-ios-gray-2">User</th>
                  <th className="text-left px-4 py-3 font-medium text-ios-gray-2">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-ios-gray-2">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-ios-gray-2">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-ios-gray-3">No users yet</td>
                  </tr>
                )}
                {list.map((u, i) => (
                  <tr key={u.id} className={i !== list.length - 1 ? 'border-b border-ios-gray-6' : ''}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={u} size="md" />
                        <div>
                          <div className="font-medium text-ios-label">{u.name || '(unnamed)'}</div>
                          <div className="text-xs text-ios-gray-3">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={e => handleRoleChange(u, e.target.value as AppRole)}
                        className="text-xs border border-ios-gray-5 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-ios-gray-3">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeactivate(u)}
                        className="text-xs text-ios-gray-2 hover:text-ios-red transition-colors"
                      >
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && <AddUserModal onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); load() }} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={(u) => { setList(prev => prev.map(x => x.id === u.id ? u : x)); setEditUser(null) }} />}
    </div>
  )
}

// ── Add User Modal ─────────────────────────────────────────────────────────────

function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ id: '', email: '', name: '', role: 'member' as AppRole })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email) return setErr('Email is required')
    setSaving(true)
    try {
      // Use email as a placeholder UUID if no real auth id provided
      const id = form.id || crypto.randomUUID()
      await usersApi.create({ ...form, id })
      onAdded()
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} title="Add User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="text-sm text-ios-red bg-red-50 p-2 rounded-lg">{err}</p>}
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Email *</label>
          <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@example.com" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Name</label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Role</label>
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as AppRole }))}
            className="w-full text-sm border border-ios-gray-5 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Adding…' : 'Add User'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Edit User Modal ────────────────────────────────────────────────────────────

function EditUserModal({ user, onClose, onSaved }: { user: AppUser; onClose: () => void; onSaved: (u: AppUser) => void }) {
  const [form, setForm] = useState({ name: user.name, role: user.role, color: user.color })
  const [saving, setSaving] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await usersApi.update(user.id, form)
      onSaved(updated)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={true} title="Edit User" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Name</label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Role</label>
          <select
            value={form.role}
            onChange={e => setForm(f => ({ ...f, role: e.target.value as AppRole }))}
            className="w-full text-sm border border-ios-gray-5 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-ios-blue/30"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Color</label>
          <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="w-full h-9 rounded-lg border border-ios-gray-5 cursor-pointer" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}
