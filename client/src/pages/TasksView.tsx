import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, X, ChevronDown, LayoutGrid, List, SlidersHorizontal, Calendar, CheckSquare, MessageSquare, FileText, Mic, Share2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { Spinner } from '@/components/ui/Spinner'
import { StatusBadge } from '@/components/ui/Badge'
import { useWorkspace, workspacePalette } from '@/contexts/WorkspaceContext'
import { useWs } from '@/hooks/useWs'
import { tasks as tasksApi, type Task } from '@/lib/api'
import { formatDate } from '@/lib/utils'

// ── Filter types ──────────────────────────────────────────────────────────────

type SortKey = 'priority' | 'due_date' | 'created_at' | 'status' | 'title'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<Task['priority'], number> = { urgent: 0, high: 1, medium: 2, low: 3 }
const STATUS_ORDER: Record<Task['status'], number> = { todo: 0, in_progress: 1, review: 2, done: 3, cancelled: 4 }

const STATUS_OPTS: { value: Task['status']; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'In Review' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

const PRIORITY_OPTS: { value: Task['priority']; label: string }[] = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

// ── Priority colour dot ───────────────────────────────────────────────────────

const PRIORITY_DOT: Record<Task['priority'], string> = {
  urgent: 'bg-ios-red',
  high: 'bg-ios-orange',
  medium: '', // ws-color via style
  low: 'bg-ios-gray-3',
}

// ── Master task row ───────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task
  workspaceList: import('@/lib/api').Workspace[]
  onClick: () => void
  onShare: () => void
}

function TaskRow({ task, workspaceList, onClick, onShare }: TaskRowProps) {
  const completedSubs = task.subtasks?.filter(s => s.completed).length ?? 0
  const totalSubs = task.subtasks?.length ?? 0
  const ws = workspaceList.find(w => w.id === task.workspace_id)
  const palette = workspacePalette(ws ?? null)
  const dotCls = PRIORITY_DOT[task.priority]

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 bg-white rounded-ios px-4 py-3 shadow-ios cursor-pointer hover:shadow-ios-md transition-all duration-150 border border-transparent hover:border-ios-gray-4"
    >
      {/* Priority dot */}
      <span
        className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotCls}`}
        style={!dotCls ? { backgroundColor: 'var(--ws-color, #007AFF)' } : {}}
      />

      {/* Workspace colour strip */}
      <span
        className="w-0.5 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: palette.color, opacity: 0.7 }}
      />

      {/* Title */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ios-label truncate">{task.title}</p>
        {task.description && (
          <p className="text-xs text-ios-gray-1 truncate mt-0.5">{task.description}</p>
        )}
      </div>

      {/* Workspace name */}
      {ws && (
        <span
          className="hidden md:block text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: palette.light, color: palette.color }}
        >
          {ws.name}
        </span>
      )}

      {/* Effort */}
      {task.effort_points && (
        <span
          className="hidden sm:block text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ backgroundColor: 'var(--ws-color-light)', color: 'var(--ws-color)' }}
        >
          {task.effort_points}
        </span>
      )}

      {/* Status */}
      <StatusBadge status={task.status} />

      {/* Due date */}
      {task.due_date && (
        <span className="hidden sm:flex items-center gap-1 text-xs text-ios-gray-1 shrink-0">
          <Calendar size={11} />
          {formatDate(task.due_date)}
        </span>
      )}

      {/* Subtasks */}
      {totalSubs > 0 && (
        <span className="hidden sm:flex items-center gap-1 text-xs text-ios-gray-1 shrink-0">
          <CheckSquare size={11} />
          {completedSubs}/{totalSubs}
        </span>
      )}

      {/* Comments */}
      {(task.comments?.length ?? 0) > 0 && (
        <span className="hidden sm:flex items-center gap-1 text-xs text-ios-gray-1 shrink-0">
          <MessageSquare size={11} />
          {task.comments!.length}
        </span>
      )}

      {/* Share */}
      <button
        onClick={e => { e.stopPropagation(); onShare() }}
        className="p-1.5 text-ios-gray-3 hover:text-ios-blue hover:bg-ios-gray-5 rounded-ios transition-all shrink-0"
        title="Copy link"
      >
        <Share2 size={13} />
      </button>
    </div>
  )
}

// ── Chip toggle ───────────────────────────────────────────────────────────────

function Chip<T extends string>({
  value, label, active, color, onClick,
}: { value: T; label: string; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all duration-150 select-none"
      style={active ? {
        backgroundColor: color ? `${color}20` : 'var(--ws-color-light, rgba(0,122,255,0.12))',
        borderColor: color ?? 'var(--ws-color, #007AFF)',
        color: color ?? 'var(--ws-color, #007AFF)',
        fontWeight: 600,
      } : {
        backgroundColor: 'white',
        borderColor: '#D1D1D6',
        color: '#8E8E93',
      }}
    >
      {active && <X size={10} />}
      {label}
    </button>
  )
}

// ── Sort select ───────────────────────────────────────────────────────────────

function SortSelect({ sortKey, sortDir, onChange }: {
  sortKey: SortKey; sortDir: SortDir
  onChange: (key: SortKey, dir: SortDir) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const opts: { key: SortKey; label: string }[] = [
    { key: 'priority', label: 'Priority' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Date Created' },
    { key: 'title', label: 'Title' },
  ]

  const current = opts.find(o => o.key === sortKey)?.label ?? 'Priority'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-ios-gray-4 bg-white text-ios-gray-1 hover:border-ios-gray-3 transition-colors"
      >
        <SlidersHorizontal size={11} />
        {current}
        <span className="text-ios-gray-3">{sortDir === 'asc' ? '↑' : '↓'}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-ios shadow-ios-lg border border-ios-gray-5 z-50 min-w-36 py-1">
          {opts.map(o => (
            <button
              key={o.key}
              onClick={() => {
                if (o.key === sortKey) onChange(sortKey, sortDir === 'asc' ? 'desc' : 'asc')
                else onChange(o.key, o.key === 'priority' || o.key === 'status' ? 'asc' : 'desc')
                setOpen(false)
              }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-ios-gray-6 flex items-center justify-between"
              style={o.key === sortKey ? { color: 'var(--ws-color, #007AFF)', fontWeight: 600 } : { color: '#3C3C43' }}
            >
              {o.label}
              {o.key === sortKey && <span className="text-ios-gray-2">{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Workspace filter dropdown ─────────────────────────────────────────────────

function WorkspaceFilter({
  workspaceList,
  selected,
  onChange,
}: {
  workspaceList: import('@/lib/api').Workspace[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all duration-150"
        style={selected.length > 0 ? {
          backgroundColor: 'var(--ws-color-light)',
          borderColor: 'var(--ws-color)',
          color: 'var(--ws-color)',
          fontWeight: 600,
        } : {
          backgroundColor: 'white',
          borderColor: '#D1D1D6',
          color: '#8E8E93',
        }}
      >
        {selected.length > 0 && <X size={10} onClick={(e) => { e.stopPropagation(); onChange([]) }} />}
        Workspace{selected.length > 1 ? ` (${selected.length})` : selected.length === 1 ? `: ${workspaceList.find(w => w.id === selected[0])?.name ?? ''}` : ''}
        <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white rounded-ios shadow-ios-lg border border-ios-gray-5 z-50 min-w-44 py-1 max-h-60 overflow-y-auto">
          {workspaceList.map(ws => {
            const palette = workspacePalette(ws)
            const active = selected.includes(ws.id)
            return (
              <button
                key={ws.id}
                onClick={() => toggle(ws.id)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-ios-gray-6 flex items-center gap-2"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: palette.color }}
                />
                <span className="flex-1 text-ios-label" style={active ? { fontWeight: 600 } : {}}>{ws.name}</span>
                {active && <span style={{ color: 'var(--ws-color)' }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function TasksView() {
  const { workspaceList, activeWorkspace, activeDescendantIds } = useWorkspace()
  const { subscribe } = useWs()

  // All tasks across all workspaces
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [view, setView] = useState<'list' | 'board'>('list')

  // Filters
  const [search, setSearch] = useState('')
  const [wsFilter, setWsFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<Task['status'][]>([])

  // Auto-sync workspace filter when active workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      setWsFilter([activeWorkspace.id, ...activeDescendantIds])
    } else {
      setWsFilter([])
    }
  }, [activeWorkspace?.id, activeDescendantIds.join(',')])
  const [priorityFilter, setPriorityFilter] = useState<Task['priority'][]>([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Create modal
  const [createModal, setCreateModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as Task['priority'] })
  const [creating, setCreating] = useState(false)
  const [createWs, setCreateWs] = useState<string>('')

  // Load all tasks across every workspace
  const load = useCallback(async () => {
    if (workspaceList.length === 0) return
    setLoading(true)
    try {
      const results = await Promise.all(
        workspaceList.map(ws => tasksApi.list({ workspaceId: ws.id }).catch(() => ({ tasks: [] as Task[] })))
      )
      const combined: Task[] = []
      const seen = new Set<string>()
      results.forEach(r => r.tasks.forEach(t => {
        if (!seen.has(t.id)) { seen.add(t.id); combined.push(t) }
      }))
      setAllTasks(combined)
    } finally {
      setLoading(false)
    }
  }, [workspaceList])

  useEffect(() => { load() }, [load])

  // Set default create workspace
  useEffect(() => {
    if (activeWorkspace && !createWs) setCreateWs(activeWorkspace.id)
  }, [activeWorkspace, createWs])

  // Real-time updates
  useEffect(() => {
    const unsubs = [
      subscribe('task.created', (evt) => {
        const task = evt.payload.task as Task
        setAllTasks(prev => prev.some(t => t.id === task.id) ? prev : [task, ...prev])
      }),
      subscribe('task.updated', (evt) => {
        const task = evt.payload.task as Task
        setAllTasks(prev => prev.map(t => t.id === task.id ? task : t))
      }),
    ]
    return () => unsubs.forEach(u => u())
  }, [subscribe])

  const handleTaskUpdate = useCallback(async (id: string, updates: Partial<Task>) => {
    const updated = await tasksApi.update(id, updates)
    setAllTasks(prev => prev.map(t => t.id === id ? updated : t))
  }, [])

  const handleCreate = async () => {
    const wsId = createWs || activeWorkspace?.id
    if (!wsId || !form.title.trim()) return
    setCreating(true)
    const task = await tasksApi.create({
      workspaceId: wsId,
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: 'todo',
      assignee_ids: [],
      labels: [],
      position: 0,
    })
    setAllTasks(prev => prev.some(t => t.id === task.id) ? prev : [task, ...prev])
    setCreateModal(false)
    setForm({ title: '', description: '', priority: 'medium' })
    setCreating(false)
  }

  const handleDelete = async (taskId: string) => {
    await tasksApi.delete(taskId)
    setAllTasks(prev => prev.filter(t => t.id !== taskId))
    setSelectedTask(null)
  }

  // ── Filtering + sorting ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = allTasks

    // Workspace filter
    if (wsFilter.length > 0) list = list.filter(t => wsFilter.includes(t.workspace_id))

    // Status filter
    if (statusFilter.length > 0) list = list.filter(t => statusFilter.includes(t.status))

    // Priority filter
    if (priorityFilter.length > 0) list = list.filter(t => priorityFilter.includes(t.priority))

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
      )
    }

    // Date range (due_date)
    if (dateFrom) list = list.filter(t => t.due_date && t.due_date >= dateFrom)
    if (dateTo) list = list.filter(t => t.due_date && t.due_date <= dateTo)

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      else if (sortKey === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      else if (sortKey === 'due_date') {
        const da = a.due_date ?? '9999'
        const db = b.due_date ?? '9999'
        cmp = da < db ? -1 : da > db ? 1 : 0
      }
      else if (sortKey === 'created_at') cmp = a.created_at < b.created_at ? -1 : 1
      else if (sortKey === 'title') cmp = a.title.localeCompare(b.title)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [allTasks, wsFilter, statusFilter, priorityFilter, search, dateFrom, dateTo, sortKey, sortDir])

  // Tasks for board view: scoped to single workspace (active or first filter)
  const boardWorkspaceId = wsFilter.length === 1 ? wsFilter[0] : (activeWorkspace?.id ?? '')
  const boardTasks = useMemo(
    () => filtered.filter(t => t.workspace_id === boardWorkspaceId),
    [filtered, boardWorkspaceId]
  )

  const hasFilters = wsFilter.length > 0 || statusFilter.length > 0 || priorityFilter.length > 0 || search || dateFrom || dateTo

  const clearAll = () => {
    setSearch(''); setWsFilter([]); setStatusFilter([]); setPriorityFilter([]); setDateFrom(''); setDateTo('')
  }

  // Count summary
  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach(t => { counts[t.status] = (counts[t.status] ?? 0) + 1 })
    return counts
  }, [filtered])

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="All Tasks"
        subtitle={`${filtered.length} task${filtered.length !== 1 ? 's' : ''}${allTasks.length !== filtered.length ? ` of ${allTasks.length}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {/* Always-visible nav shortcuts */}
            <Link
              to="/pages"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-ios text-xs font-medium text-ios-gray-1 hover:bg-ios-gray-5 transition-colors"
              title="Go to Docs"
            >
              <FileText size={14} />
              <span>Docs</span>
            </Link>
            <Link
              to="/audio"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-ios text-xs font-medium text-ios-gray-1 hover:bg-ios-gray-5 transition-colors"
              title="Go to Recordings"
            >
              <Mic size={14} />
              <span>Recordings</span>
            </Link>
            <div className="w-px h-5 bg-ios-gray-5" />
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-ios transition-colors ${view === 'list' ? 'ws-btn-primary' : 'text-ios-gray-1 hover:bg-ios-gray-5'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setView('board')}
              className={`p-2 rounded-ios transition-colors ${view === 'board' ? 'ws-btn-primary' : 'text-ios-gray-1 hover:bg-ios-gray-5'}`}
            >
              <LayoutGrid size={16} />
            </button>
            <Button size="sm" onClick={() => setCreateModal(true)}>
              <Plus size={14} />
              New Task
            </Button>
          </div>
        }
      />

      {/* ── Filter bar ── */}
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-ios-gray-5 space-y-2" style={{ backgroundColor: 'var(--ws-color-light, #F2F2F7)' }}>
        {/* Row 1: search + sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ios-gray-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tasks…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-ios border border-ios-gray-4 bg-white text-ios-label outline-none ws-focus"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ios-gray-2 hover:text-ios-gray-1">
                <X size={12} />
              </button>
            )}
          </div>

          {/* Date from/to */}
          <div className="flex items-center gap-1 text-xs text-ios-gray-1">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="text-xs rounded-ios border border-ios-gray-4 bg-white px-2 py-1 outline-none ws-focus text-ios-label w-32"
            />
            <span>–</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="text-xs rounded-ios border border-ios-gray-4 bg-white px-2 py-1 outline-none ws-focus text-ios-label w-32"
            />
          </div>

          <div className="flex-1" />
          <SortSelect sortKey={sortKey} sortDir={sortDir} onChange={(k, d) => { setSortKey(k); setSortDir(d) }} />

          {hasFilters && (
            <button onClick={clearAll} className="text-xs text-ios-gray-1 hover:ws-text flex items-center gap-1">
              <X size={11} /> Clear
            </button>
          )}
        </div>

        {/* Row 2: filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Workspace */}
          <WorkspaceFilter workspaceList={workspaceList} selected={wsFilter} onChange={setWsFilter} />

          <div className="w-px h-4 bg-ios-gray-4 mx-1" />

          {/* Status chips */}
          {STATUS_OPTS.map(o => (
            <Chip
              key={o.value}
              value={o.value}
              label={`${o.label}${countByStatus[o.value] ? ` ${countByStatus[o.value]}` : ''}`}
              active={statusFilter.includes(o.value)}
              onClick={() => setStatusFilter(prev =>
                prev.includes(o.value) ? prev.filter(s => s !== o.value) : [...prev, o.value]
              )}
            />
          ))}

          <div className="w-px h-4 bg-ios-gray-4 mx-1" />

          {/* Priority chips */}
          {PRIORITY_OPTS.map(o => {
            const colors: Record<string, string> = { urgent: '#FF3B30', high: '#FF9500', medium: 'var(--ws-color,#007AFF)', low: '#8E8E93' }
            return (
              <Chip
                key={o.value}
                value={o.value}
                label={o.label}
                active={priorityFilter.includes(o.value)}
                color={colors[o.value]}
                onClick={() => setPriorityFilter(prev =>
                  prev.includes(o.value) ? prev.filter(p => p !== o.value) : [...prev, o.value]
                )}
              />
            )
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex justify-center pt-12"><Spinner /></div>
        ) : view === 'list' ? (
          <div className="p-4 space-y-2 max-w-5xl mx-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-ios-gray-1 text-sm">
                {hasFilters ? 'No tasks match the current filters' : 'No tasks yet — create one to get started'}
              </div>
            ) : (
              filtered.map(task => (
                <TaskRow
                  key={task.id}
                  task={task}
                  workspaceList={workspaceList}
                  onClick={() => setSelectedTask(task)}
                  onShare={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/tasks?task=${task.id}`)
                  }}
                />
              ))
            )}
          </div>
        ) : (
          <TaskBoard
            tasks={boardTasks}
            onTaskClick={setSelectedTask}
            onTaskCreate={(status) => setCreateModal(true)}
            onTaskUpdate={handleTaskUpdate}
          />
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createModal}
        onClose={() => setCreateModal(false)}
        title="New Task"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!form.title.trim()}>Create Task</Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Workspace selector */}
          <div>
            <label className="text-sm font-medium text-ios-label">Workspace</label>
            <select
              value={createWs}
              onChange={e => setCreateWs(e.target.value)}
              className="w-full mt-1 text-sm rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 text-ios-label outline-none ws-focus"
            >
              {workspaceList.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Task title"
            autoFocus
          />
          <Textarea
            label="Description"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Optional description"
            rows={3}
          />
          <div>
            <label className="text-sm font-medium text-ios-label">Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as Task['priority'] }))}
              className="w-full mt-1 text-sm rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 text-ios-label outline-none ws-focus"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Task detail side panel */}
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(updated) => {
            setAllTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
            setSelectedTask(updated)
          }}
          onDelete={() => handleDelete(selectedTask.id)}
        />
      )}
    </div>
  )
}
