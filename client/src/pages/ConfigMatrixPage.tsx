import React, { useEffect, useState } from 'react'
import { Settings, Save, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TopBar } from '@/components/layout/TopBar'
import { Spinner } from '@/components/ui/Spinner'
import { configMatrix as configApi } from '@/lib/api'
import type { ConfigMatrixRow, AppRole } from '@/lib/api'

const ROLES: AppRole[] = ['admin', 'manager', 'member', 'viewer', 'guest']

const ROLE_STYLES: Record<AppRole, string> = {
  admin:   'bg-[#5e3aa0] text-white',
  manager: 'bg-blue-100 text-blue-700',
  member:  'bg-green-100 text-green-700',
  viewer:  'bg-slate-100 text-slate-500',
  guest:   'bg-orange-100 text-orange-700',
}

const FEATURE_SECTIONS = [
  { group: 'Tasks',    features: [{ id: 'tasks_view', label: 'View Tasks' }, { id: 'tasks_edit', label: 'Edit Tasks' }] },
  { group: 'Pages',    features: [{ id: 'pages_view', label: 'View Pages' }, { id: 'pages_edit', label: 'Edit Pages' }] },
  { group: 'Audio',    features: [{ id: 'audio_view', label: 'Listen to Recordings' }, { id: 'audio_record', label: 'Record Audio' }] },
  { group: 'Admin',    features: [
    { id: 'settings',     label: 'App Settings' },
    { id: 'users_manage', label: 'Manage Users' },
    { id: 'groups_manage', label: 'Manage Groups' },
  ]},
]

// Locked features per role — always on
const ALWAYS_ON: Partial<Record<AppRole, string[]>> = {
  admin: ['tasks_view', 'tasks_edit', 'pages_view', 'pages_edit', 'audio_view', 'audio_record', 'settings', 'users_manage', 'groups_manage'],
}

type MatrixMap = Record<string, Record<AppRole, boolean>>

function toMap(rows: ConfigMatrixRow[]): MatrixMap {
  const m: MatrixMap = {}
  rows.forEach(r => {
    if (!m[r.feature]) m[r.feature] = {} as Record<AppRole, boolean>
    m[r.feature][r.role] = r.enabled
  })
  return m
}

const DEFAULT_MAP: MatrixMap = (() => {
  const m: MatrixMap = {}
  FEATURE_SECTIONS.flatMap(s => s.features).forEach(({ id }) => {
    m[id] = {
      admin: true, manager: id.endsWith('_view') || id === 'groups_manage',
      member: id.endsWith('_view'), viewer: id === 'tasks_view' || id === 'pages_view' || id === 'audio_view',
      guest: false,
    }
  })
  return m
})()

export function ConfigMatrixPage() {
  const [matrix, setMatrix] = useState<MatrixMap>(JSON.parse(JSON.stringify(DEFAULT_MAP)))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { matrix: rows } = await configApi.list()
      if (rows && rows.length > 0) {
        const built: MatrixMap = JSON.parse(JSON.stringify(DEFAULT_MAP))
        rows.forEach(r => {
          if (!built[r.feature]) built[r.feature] = {} as Record<AppRole, boolean>
          built[r.feature][r.role] = r.enabled
        })
        setMatrix(built)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function toggle(feature: string, role: AppRole) {
    if (ALWAYS_ON[role]?.includes(feature)) return
    setMatrix(prev => ({
      ...prev,
      [feature]: { ...prev[feature], [role]: !prev[feature]?.[role] }
    }))
    setDirty(true)
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      const rows: { feature: string; role: AppRole; enabled: boolean }[] = []
      Object.entries(matrix).forEach(([feature, roleMap]) => {
        ROLES.forEach(role => {
          rows.push({ feature, role, enabled: roleMap[role] ?? false })
        })
      })
      await configApi.bulkUpsert(rows)
      setDirty(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setMatrix(JSON.parse(JSON.stringify(DEFAULT_MAP)))
    setDirty(true)
    setSaved(false)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Access Configuration"
        subtitle="Feature access per role"
        accentColor="#5e3aa0"
      />

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <>
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#5e3aa0]" />
                <h2 className="text-base font-bold text-[#5e3aa0]">Role Permission Matrix</h2>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset to defaults
                </button>
                <button
                  onClick={save}
                  disabled={saving || !dirty}
                  className="flex items-center gap-1.5 text-sm px-4 py-1.5 bg-[#5e3aa0] text-white rounded-lg hover:bg-[#4a2d80] disabled:opacity-50 transition-colors font-medium"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Matrix'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Description */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <p className="text-sm text-slate-600">
                  Control which roles can access each feature. <strong>Admin</strong> always has full access. Changes take effect immediately after saving.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    {/* Role badges row */}
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-52">Feature</th>
                      {ROLES.map(role => (
                        <th key={role} className="px-4 py-3 text-center">
                          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full capitalize', ROLE_STYLES[role])}>
                            {role}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FEATURE_SECTIONS.map(({ group, features }) => (
                      <React.Fragment key={group}>
                        {/* Group header row */}
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <td
                            colSpan={ROLES.length + 1}
                            className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider"
                          >
                            {group}
                          </td>
                        </tr>
                        {/* Feature rows */}
                        {features.map(({ id: featureId, label }, i) => (
                          <tr
                            key={featureId}
                            className={cn(
                              'border-b border-slate-50 hover:bg-slate-50 transition-colors',
                              i % 2 !== 0 && 'bg-slate-50/40'
                            )}
                          >
                            <td className="px-4 py-3 font-medium text-slate-700">{label}</td>
                            {ROLES.map(role => {
                              const locked = !!(ALWAYS_ON[role]?.includes(featureId))
                              const checked = locked || (matrix[featureId]?.[role] ?? false)
                              return (
                                <td key={role} className="px-4 py-3 text-center">
                                  <button
                                    onClick={() => toggle(featureId, role)}
                                    disabled={locked}
                                    className={cn(
                                      'w-6 h-6 rounded border-2 transition-all flex items-center justify-center mx-auto',
                                      checked
                                        ? 'bg-[#5e3aa0] border-[#5e3aa0] text-white'
                                        : 'border-slate-200 hover:border-slate-400 bg-white',
                                      locked && 'cursor-not-allowed opacity-60'
                                    )}
                                  >
                                    {checked && <span className="text-xs leading-none font-bold">✓</span>}
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-5 px-4 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded border-2 bg-[#5e3aa0] border-[#5e3aa0] inline-flex items-center justify-center text-white font-bold text-xs">✓</span>
                  Access granted
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded border-2 border-slate-200 inline-block bg-white" />
                  No access
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 rounded border-2 bg-[#5e3aa0]/40 border-[#5e3aa0]/40 inline-flex items-center justify-center text-white font-bold text-xs">✓</span>
                  Always on (locked)
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
