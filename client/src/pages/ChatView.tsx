import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Hash, Plus, Send, Paperclip, Pin, X, MessageSquare, ExternalLink, Circle, Search, FileText, FileSpreadsheet, File, UploadCloud, CheckSquare, CalendarDays, AlertCircle, Mic, Camera } from 'lucide-react'
import { AudioRecorderClient, formatDuration } from '@/lib/audio'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useAuth } from '@/contexts/AuthContext'
import { useWs } from '@/hooks/useWs'
import { chat as chatApi, tasks as tasksApi, users as usersApi, type ChatChannel, type ChatMessage, type AppUser, type Task } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── File helpers ──────────────────────────────────────────────────────────────

function fileIcon(fileType?: string) {
  if (!fileType) return <File size={20} className="text-ios-gray-2" />
  if (fileType.includes('pdf')) return <FileText size={20} className="text-ios-red" />
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv'))
    return <FileSpreadsheet size={20} className="text-ios-green" />
  if (fileType.includes('word') || fileType.includes('document'))
    return <FileText size={20} className="text-ios-blue" />
  return <File size={20} className="text-ios-gray-2" />
}

function fileLabel(fileType?: string): string {
  if (!fileType) return 'File'
  if (fileType.includes('pdf')) return 'PDF'
  if (fileType.includes('sheet') || fileType.includes('excel')) return 'Spreadsheet'
  if (fileType.includes('csv')) return 'CSV'
  if (fileType.includes('word') || fileType.includes('document')) return 'Document'
  return 'File'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

// ── Task Detail Panel (embedded, non-modal) ───────────────────────────────────

function TaskDetailPanel({ task, onClose, onUpdate, onDelete }: {
  task: Task
  onClose: () => void
  onUpdate: (t: Task) => void
  onDelete: () => void
}) {
  const { activeWorkspace } = useWorkspace()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [effortPoints, setEffortPoints] = useState(task.effort_points ?? '')
  const [subtasks, setSubtasks] = useState(task.subtasks ?? [])
  const [comments, setComments] = useState(task.comments ?? [])
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingComment, setAddingComment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when task changes
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description ?? '')
    setEffortPoints(task.effort_points ?? '')
    setSubtasks(task.subtasks ?? [])
    setComments(task.comments ?? [])
  }, [task.id])

  const STATUSES: Task['status'][] = ['todo', 'in_progress', 'review', 'done', 'cancelled']
  const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high', 'urgent']

  const STATUS_BADGE: Record<Task['status'], string> = {
    todo: 'bg-ios-gray-5 text-ios-gray-2',
    in_progress: 'ws-bg ws-text',
    review: 'bg-yellow-100 text-yellow-700',
    done: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-ios-red',
  }

  const save = async () => {
    setSaving(true)
    try {
      const updated = await tasksApi.update(task.id, { title, description, effort_points: effortPoints || undefined })
      onUpdate(updated)
    } finally {
      setSaving(false)
    }
  }

  const changeStatus = async (status: Task['status']) => {
    const updated = await tasksApi.update(task.id, { status })
    onUpdate(updated)
  }

  const changePriority = async (priority: Task['priority']) => {
    const updated = await tasksApi.update(task.id, { priority })
    onUpdate(updated)
  }

  const addSubtask = async () => {
    if (!newSubtask.trim()) return
    const sub = await tasksApi.subtasks.create(task.id, { title: newSubtask })
    setSubtasks(prev => [...prev, sub])
    setNewSubtask('')
  }

  const toggleSubtask = async (sub: import('@/lib/api').Subtask) => {
    const updated = await tasksApi.subtasks.update(task.id, sub.id, { completed: !sub.completed })
    setSubtasks(prev => prev.map(s => s.id === sub.id ? updated : s))
  }

  const deleteSubtask = async (subId: string) => {
    await tasksApi.subtasks.delete(task.id, subId)
    setSubtasks(prev => prev.filter(s => s.id !== subId))
  }

  const addComment = async () => {
    if (!newComment.trim()) return
    setAddingComment(true)
    try {
      const comment = await tasksApi.comments.create(task.id, { content: newComment })
      setComments(prev => [...prev, comment])
      setNewComment('')
    } finally {
      setAddingComment(false)
    }
  }

  const deleteComment = async (cid: string) => {
    await tasksApi.comments.delete(task.id, cid)
    setComments(prev => prev.filter(c => c.id !== cid))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-ios-gray-5 bg-white">
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', STATUS_BADGE[task.status] ?? STATUS_BADGE.todo)}>
          {task.status.replace('_', ' ')}
        </span>
        <button onClick={onClose} className="p-1.5 text-ios-gray-2 hover:bg-ios-gray-6 rounded-ios transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full text-base font-semibold text-ios-label outline-none bg-transparent rounded-lg px-2 py-1 -mx-2 hover:bg-ios-gray-6 focus:bg-ios-gray-6 transition-colors"
          placeholder="Task title"
        />

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-ios-gray-1 mb-1">Status</p>
            <select
              value={task.status}
              onChange={e => changeStatus(e.target.value as Task['status'])}
              className="w-full text-xs rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 text-ios-label outline-none"
            >
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs text-ios-gray-1 mb-1">Priority</p>
            <select
              value={task.priority}
              onChange={e => changePriority(e.target.value as Task['priority'])}
              className="w-full text-xs rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 text-ios-label outline-none"
            >
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Effort */}
        <div>
          <p className="text-xs text-ios-gray-1 mb-1">Effort</p>
          <input
            value={effortPoints}
            onChange={e => setEffortPoints(e.target.value)}
            onBlur={save}
            placeholder="3h, 2 days, 5 pts…"
            className="w-full text-xs rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 text-ios-label outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <p className="text-xs text-ios-gray-1 mb-1">Description</p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={save}
            rows={3}
            className="w-full text-sm text-ios-label rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 outline-none resize-none"
            placeholder="Add a description…"
          />
        </div>

        {/* Subtasks */}
        <div>
          <p className="text-xs font-medium text-ios-gray-1 mb-2">
            Subtasks ({subtasks.filter(s => s.completed).length}/{subtasks.length})
          </p>
          <div className="space-y-1">
            {subtasks.map(sub => (
              <div key={sub.id} className="flex items-center gap-2 group">
                <input
                  type="checkbox"
                  checked={sub.completed}
                  onChange={() => toggleSubtask(sub)}
                  className="rounded ws-accent"
                />
                <span className={cn('text-sm flex-1', sub.completed && 'line-through text-ios-gray-2')}>
                  {sub.title}
                </span>
                <button
                  onClick={() => deleteSubtask(sub.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-ios-red transition-opacity"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={newSubtask}
              onChange={e => setNewSubtask(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSubtask()}
              className="flex-1 text-xs rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 outline-none"
              placeholder="Add subtask…"
            />
            <button onClick={addSubtask} className="p-2 ws-btn-primary rounded-ios transition-colors">
              <Plus size={13} />
            </button>
          </div>
        </div>

        {/* Comments */}
        <div>
          <p className="text-xs font-medium text-ios-gray-1 mb-2">
            Comments {comments.length > 0 && `(${comments.length})`}
          </p>
          {comments.length === 0 ? (
            <p className="text-xs text-ios-gray-3 mb-2">No comments yet.</p>
          ) : (
            <div className="space-y-2 mb-2">
              {comments.map(c => (
                <div key={c.id} className="bg-ios-gray-6 rounded-ios border border-ios-gray-5/60 p-2.5 group relative">
                  <p className="text-xs text-ios-label pr-5 leading-relaxed">{c.content}</p>
                  <p className="text-[11px] text-ios-gray-3 mt-1">
                    {new Date(c.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <button
                    onClick={() => deleteComment(c.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-ios-red transition-opacity"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addComment()}
              className="flex-1 text-xs rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 outline-none"
              placeholder="Add comment…"
            />
            <button
              onClick={addComment}
              disabled={addingComment}
              className="p-2 ws-btn-primary rounded-ios disabled:opacity-50 transition-colors"
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Footer — delete */}
      <div className="shrink-0 px-4 py-3 border-t border-ios-gray-5 flex justify-end">
        <button
          onClick={() => { if (confirm('Delete this task?')) onDelete() }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-ios bg-red-50 border border-red-200 text-ios-red hover:bg-red-100 transition-colors"
        >
          <X size={12} /> Delete task
        </button>
      </div>
    </div>
  )
}

// ── Inline Task Card ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<Task['status'], string> = {
  todo:        'bg-ios-gray-4 text-ios-gray-1',
  in_progress: 'bg-blue-100 text-ios-blue',
  review:      'bg-yellow-100 text-yellow-700',
  done:        'bg-green-100 text-ios-green',
  cancelled:   'bg-red-100 text-ios-red',
}
const STATUS_LABEL: Record<Task['status'], string> = {
  todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done', cancelled: 'Cancelled',
}
const PRIORITY_COLOR: Record<Task['priority'], string> = {
  urgent: 'text-ios-red',
  high:   'text-ios-orange',
  medium: 'text-ios-blue',
  low:    'text-ios-gray-3',
}

function InlineTaskCard({ taskId, onOpen }: { taskId: string; onOpen: (task: Task) => void }) {
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tasksApi.get(taskId)
      .then(setTask)
      .catch(() => setTask(null))
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-ios-gray-3 bg-ios-gray-6 rounded-xl px-3 py-2">
        <Spinner size="sm" />
        <span>Loading task…</span>
      </div>
    )
  }

  if (!task) return null

  return (
    <button
      onClick={() => onOpen(task)}
      className="mt-2 w-full text-left bg-white border border-ios-gray-4 rounded-xl px-3 py-2.5 hover:border-[var(--ws-color,#007AFF)] hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-2">
        <Circle
          size={13}
          className={cn('shrink-0 mt-0.5', PRIORITY_COLOR[task.priority])}
          fill="currentColor"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ios-label leading-snug line-clamp-2">{task.title}</p>
          {task.description && (
            <p className="text-xs text-ios-gray-2 mt-0.5 line-clamp-1">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded-md', STATUS_COLOR[task.status])}>
              {STATUS_LABEL[task.status]}
            </span>
            <span className="text-[11px] text-ios-gray-3 capitalize">{task.priority}</span>
            {task.due_date && (
              <span className="text-[11px] text-ios-gray-3">
                Due {new Date(task.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        </div>
        <ExternalLink size={13} className="shrink-0 text-ios-gray-3 group-hover:text-[var(--ws-color,#007AFF)] transition-colors mt-0.5" />
      </div>
    </button>
  )
}

// ── Image Grid (WhatsApp-style 2×2 with N+ overflow) ─────────────────────────

function ImageGrid({ urls, isOwn }: { urls: { url: string; name: string }[]; isOwn: boolean }) {
  const visible = urls.slice(0, 4)
  const overflow = urls.length - 4

  if (urls.length === 1) {
    return (
      <a href={urls[0].url} target="_blank" rel="noopener noreferrer" className="block mt-1">
        <img
          src={urls[0].url}
          alt={urls[0].name}
          className="max-w-xs max-h-56 rounded-xl object-cover cursor-zoom-in"
        />
      </a>
    )
  }

  return (
    <div className={cn('mt-1 grid gap-0.5 rounded-xl overflow-hidden', urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2')}>
      {visible.map((img, i) => {
        const isLast = i === 3 && overflow > 0
        return (
          <a
            key={i}
            href={img.url}
            target="_blank"
            rel="noopener noreferrer"
            className="relative block aspect-square overflow-hidden"
          >
            <img
              src={img.url}
              alt={img.name}
              className="w-full h-full object-cover"
              style={{ maxWidth: 130, maxHeight: 130 }}
            />
            {isLast && (
              <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                <span className="text-white text-lg font-bold">+{overflow}</span>
              </div>
            )}
          </a>
        )
      })}
    </div>
  )
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isOwn,
  user,
  workspaceId,
  channelId,
  groupedImages,
  onPinned,
  onOpenTask,
}: {
  msg: ChatMessage
  isOwn: boolean
  user: AppUser | undefined
  workspaceId: string
  channelId: string
  groupedImages?: { url: string; name: string }[]
  onPinned: (msg: ChatMessage, taskId: string) => void
  onOpenTask: (task: Task) => void
}) {
  const [pinning, setPinning] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(msg.task_id ?? null)

  const displayName = user?.name || user?.email?.split('@')[0] || 'Unknown'
  const isImage = msg.file_type?.startsWith('image/')

  async function handlePin() {
    if (taskId || pinning) return
    setPinning(true)
    try {
      const result = await chatApi.pinAsTask(channelId, msg.id, workspaceId)
      setTaskId(result.task.id)
      onPinned(msg, result.task.id)
    } catch (e) {
      console.error('Pin failed', e)
    } finally {
      setPinning(false)
    }
  }

  return (
    <div className={cn('flex gap-2.5 group', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        <Avatar
          name={user?.name || user?.email || '?'}
          src={user?.avatar_url}
          size="sm"
        />
      </div>

      {/* Bubble content */}
      <div className={cn('flex flex-col max-w-[85%] sm:max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Name + time */}
        <div className={cn('flex items-baseline gap-1.5 mb-1', isOwn ? 'flex-row-reverse' : 'flex-row')}>
          <span className="text-xs font-semibold text-ios-label">
            {isOwn ? 'You' : displayName}
          </span>
          <span className="text-[11px] text-ios-gray-3">{formatTime(msg.created_at)}</span>
        </div>

        {/* Bubble */}
        <div className={cn(
          'relative px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words',
          isOwn
            ? 'rounded-tr-sm bg-[var(--ws-color,#007AFF)] text-white'
            : 'rounded-tl-sm bg-white border border-ios-gray-5 text-ios-label shadow-sm'
        )}>
          {/* Text body */}
          {msg.body && <p className="whitespace-pre-wrap">{msg.body}</p>}

          {/* Image attachment — use grid if grouped, else single */}
          {isImage && msg.file_url && (
            groupedImages
              ? <ImageGrid urls={groupedImages} isOwn={isOwn} />
              : (
                <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                  <img
                    src={msg.file_url}
                    alt={msg.file_name || 'attachment'}
                    className="max-w-xs max-h-48 rounded-xl object-cover cursor-zoom-in"
                  />
                </a>
              )
          )}

          {/* Audio attachment */}
          {msg.file_type?.startsWith('audio/') && msg.file_url && (
            <div className={cn('mt-2 rounded-xl overflow-hidden', isOwn ? 'bg-white/20' : 'bg-ios-gray-6 border border-ios-gray-4')}>
              <audio
                controls
                src={msg.file_url}
                className="w-full max-w-xs"
                style={{ height: 36 }}
              />
            </div>
          )}

          {/* Non-image file — rich thumbnail card */}
          {!isImage && !msg.file_type?.startsWith('audio/') && msg.file_url && (
            <a
              href={msg.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-3 mt-2 px-3 py-2.5 rounded-xl transition-colors',
                isOwn
                  ? 'bg-white/20 hover:bg-white/30'
                  : 'bg-ios-gray-6 hover:bg-ios-gray-5 border border-ios-gray-4'
              )}
            >
              <div className={cn('shrink-0 w-9 h-9 rounded-lg flex items-center justify-center', isOwn ? 'bg-white/30' : 'bg-white border border-ios-gray-5')}>
                {fileIcon(msg.file_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-xs font-medium truncate', isOwn ? 'text-white' : 'text-ios-label')}>
                  {msg.file_name || 'attachment'}
                </p>
                <p className={cn('text-[11px]', isOwn ? 'text-white/70' : 'text-ios-gray-2')}>
                  {fileLabel(msg.file_type)} · tap to open
                </p>
              </div>
              <ExternalLink size={13} className={cn('shrink-0', isOwn ? 'text-white/60' : 'text-ios-gray-3')} />
            </a>
          )}

        </div>

        {/* Inline task card — shown below bubble when task exists */}
        {taskId && <InlineTaskCard taskId={taskId} onOpen={onOpenTask} />}

        {/* Pin button — shown on hover when no task yet */}
        {!taskId && (
          <button
            onClick={handlePin}
            disabled={pinning}
            className={cn(
              'mt-1 flex items-center gap-1 text-[11px] text-ios-gray-3 hover:text-ios-blue transition-colors opacity-0 group-hover:opacity-100',
              pinning && 'opacity-50 cursor-wait'
            )}
          >
            <Pin size={11} />
            {pinning ? 'Creating task...' : 'Pin as task'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Task Picker Popover ───────────────────────────────────────────────────────

function TaskPickerPopover({
  query,
  tasks,
  onSelect,
  onClose,
}: {
  query: string
  tasks: Task[]
  onSelect: (task: Task) => void
  onClose: () => void
}) {
  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(query.toLowerCase()) ||
    (t.description ?? '').toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8)

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white border border-ios-gray-4 rounded-2xl shadow-lg overflow-hidden z-50">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ios-gray-5 bg-ios-gray-6/50">
        <Search size={13} className="text-ios-gray-2 shrink-0" />
        <span className="text-xs text-ios-gray-2">
          {query ? `Tasks matching "${query}"` : 'Search tasks…'}
        </span>
        <button
          onMouseDown={e => { e.preventDefault(); onClose() }}
          className="ml-auto text-ios-gray-3 hover:text-ios-gray-1 transition-colors p-0.5"
        >
          <X size={13} />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-ios-gray-3">
          {query ? 'No tasks found' : 'Type to search tasks'}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-ios-gray-5/60">
          {filtered.map(task => (
            <button
              key={task.id}
              onMouseDown={e => { e.preventDefault(); onSelect(task) }}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-ios-gray-6 transition-colors text-left group"
            >
              <Circle
                size={10}
                className={cn('shrink-0 mt-1', PRIORITY_COLOR[task.priority])}
                fill="currentColor"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ios-label leading-snug line-clamp-1">{task.title}</p>
                {task.description && (
                  <p className="text-xs text-ios-gray-3 mt-0.5 line-clamp-1">{task.description}</p>
                )}
              </div>
              <span className={cn('shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-md mt-0.5', STATUS_COLOR[task.status])}>
                {STATUS_LABEL[task.status]}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="px-3 py-1.5 border-t border-ios-gray-5 bg-ios-gray-6/40">
        <p className="text-[11px] text-ios-gray-3">Type to filter · Click to attach · Esc to dismiss</p>
      </div>
    </div>
  )
}

// ── Natural date parser ────────────────────────────────────────────────────────

function parseNaturalDate(s: string): string | undefined {
  if (!s?.trim()) return undefined
  const raw = s.trim().toLowerCase()
  const now = new Date()

  // Time-only: "2pm", "14:30", "9am", "3:45pm"
  const timeMatch = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/)
  if (timeMatch) {
    let h = parseInt(timeMatch[1])
    const m = parseInt(timeMatch[2] ?? '0')
    const ampm = timeMatch[3]
    if (ampm === 'pm' && h < 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    const d = new Date(now)
    d.setHours(h, m, 0, 0)
    return d.toISOString()
  }

  // Day names: "monday", "mon", "tuesday", "tue", etc.
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  const SHORT_DAYS = ['sun','mon','tue','wed','thu','fri','sat']
  let dayIdx = DAYS.indexOf(raw)
  if (dayIdx === -1) dayIdx = SHORT_DAYS.indexOf(raw)
  if (dayIdx !== -1) {
    const d = new Date(now)
    const diff = (dayIdx - d.getDay() + 7) % 7 || 7 // always next occurrence
    d.setDate(d.getDate() + diff)
    d.setHours(9, 0, 0, 0)
    return d.toISOString()
  }

  // "today", "tomorrow"
  if (raw === 'today') { const d = new Date(now); d.setHours(23, 59, 0, 0); return d.toISOString() }
  if (raw === 'tomorrow') { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.toISOString() }
  if (raw === 'next week') { const d = new Date(now); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d.toISOString() }

  // Slash/dash dates: "10/5/2026", "10/5", "2026-10-05"
  const slashMatch = raw.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/)
  if (slashMatch) {
    const month = parseInt(slashMatch[1]) - 1
    const day = parseInt(slashMatch[2])
    const year = slashMatch[3] ? parseInt(slashMatch[3].length === 2 ? '20' + slashMatch[3] : slashMatch[3]) : now.getFullYear()
    const d = new Date(year, month, day, 9, 0, 0)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  // ISO-ish: "2026-10-05"
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const d = new Date(`${raw}T09:00:00`)
    if (!isNaN(d.getTime())) return d.toISOString()
  }

  return undefined
}

function formatDatePreview(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const opts: Intl.DateTimeFormatOptions = isToday
    ? { hour: 'numeric', minute: '2-digit' }
    : { weekday: 'short', month: 'short', day: 'numeric' }
  return d.toLocaleString([], opts)
}

// ── Task Create Popover ────────────────────────────────────────────────────────

interface BangFields {
  title: string
  description: string
  dueDateRaw: string
  priority: Task['priority']
}

function TaskCreatePopover({
  fields,
  onFieldChange,
  onSubmit,
  onClose,
  creating,
}: {
  fields: BangFields
  onFieldChange: (f: Partial<BangFields>) => void
  onSubmit: () => void
  onClose: () => void
  creating: boolean
}) {
  const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high', 'urgent']
  const PRIORITY_LABELS: Record<Task['priority'], string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }
  const PRIORITY_COLORS: Record<Task['priority'], string> = {
    low: 'text-ios-gray-3 border-ios-gray-4',
    medium: 'text-ios-blue border-ios-blue/40',
    high: 'text-ios-orange border-orange-300',
    urgent: 'text-ios-red border-red-300',
  }

  const parsedDate = parseNaturalDate(fields.dueDateRaw)
  const datePreview = formatDatePreview(parsedDate)

  const titleRef = useRef<HTMLInputElement>(null)
  useEffect(() => { titleRef.current?.focus() }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmit() }
  }

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-white border border-ios-gray-4 rounded-2xl shadow-xl overflow-hidden z-50"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ios-gray-5 bg-ios-gray-6/50">
        <CheckSquare size={14} className="text-[var(--ws-color,#007AFF)] shrink-0" />
        <span className="text-xs font-semibold text-ios-label">Quick Task</span>
        <span className="text-[11px] text-ios-gray-3 ml-1">⌘↵ to create</span>
        <button
          onMouseDown={e => { e.preventDefault(); onClose() }}
          className="ml-auto text-ios-gray-3 hover:text-ios-gray-1 transition-colors p-0.5"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Title */}
        <div>
          <input
            ref={titleRef}
            value={fields.title}
            onChange={e => onFieldChange({ title: e.target.value })}
            placeholder="Task title…"
            className="w-full text-sm font-medium text-ios-label rounded-xl border border-ios-gray-4 bg-ios-gray-6 px-3 py-2 outline-none focus:border-[var(--ws-color,#007AFF)] focus:bg-white transition-colors placeholder:text-ios-gray-3"
          />
        </div>

        {/* Description */}
        <div>
          <textarea
            value={fields.description}
            onChange={e => onFieldChange({ description: e.target.value })}
            placeholder="Description (optional)…"
            rows={2}
            className="w-full text-xs text-ios-label rounded-xl border border-ios-gray-4 bg-ios-gray-6 px-3 py-2 outline-none focus:border-[var(--ws-color,#007AFF)] focus:bg-white transition-colors resize-none placeholder:text-ios-gray-3"
          />
        </div>

        <div className="flex gap-2">
          {/* Due date */}
          <div className="flex-1">
            <div className="relative">
              <CalendarDays size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ios-gray-3 pointer-events-none" />
              <input
                value={fields.dueDateRaw}
                onChange={e => onFieldChange({ dueDateRaw: e.target.value })}
                placeholder="Due: friday, 2pm, 10/5…"
                className="w-full text-xs text-ios-label rounded-xl border border-ios-gray-4 bg-ios-gray-6 pl-7 pr-3 py-2 outline-none focus:border-[var(--ws-color,#007AFF)] focus:bg-white transition-colors placeholder:text-ios-gray-3"
              />
            </div>
            {fields.dueDateRaw && (
              <p className="text-[11px] mt-0.5 pl-1" style={{ color: parsedDate ? 'var(--ws-color,#007AFF)' : '#FF3B30' }}>
                {parsedDate ? `→ ${datePreview}` : 'Unrecognised date'}
              </p>
            )}
          </div>

          {/* Priority picker */}
          <div className="w-28">
            <div className="relative">
              <AlertCircle size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ios-gray-3 pointer-events-none" />
              <select
                value={fields.priority}
                onChange={e => onFieldChange({ priority: e.target.value as Task['priority'] })}
                className={cn(
                  'w-full text-xs rounded-xl border bg-ios-gray-6 pl-7 pr-2 py-2 outline-none transition-colors appearance-none',
                  PRIORITY_COLORS[fields.priority]
                )}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-ios-gray-5 bg-ios-gray-6/30">
        <p className="text-[11px] text-ios-gray-3">
          Tip: <span className="font-mono bg-ios-gray-5 px-1 rounded">!title !!desc !!fri !!urgent</span>
        </p>
        <div className="flex gap-2">
          <button
            onMouseDown={e => { e.preventDefault(); onClose() }}
            className="text-xs px-3 py-1.5 rounded-lg text-ios-gray-2 hover:bg-ios-gray-5 transition-colors"
          >
            Cancel
          </button>
          <button
            onMouseDown={e => { e.preventDefault(); onSubmit() }}
            disabled={!fields.title.trim() || creating}
            className="text-xs px-3 py-1.5 rounded-lg bg-[var(--ws-color,#007AFF)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {creating ? 'Creating…' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pending file preview strip ────────────────────────────────────────────────

interface PendingFile {
  file: File
  previewUrl: string | null // object URL for images, null for docs
}

function PendingFileStrip({
  files,
  onRemove,
}: {
  files: PendingFile[]
  onRemove: (idx: number) => void
}) {
  if (!files.length) return null
  return (
    <div className="flex flex-wrap gap-2 mb-2 px-0.5">
      {files.map((pf, i) => {
        const isImage = pf.file.type.startsWith('image/')
        return (
          <div key={i} className="relative group">
            {isImage && pf.previewUrl ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-ios-gray-4 bg-ios-gray-6">
                <img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-16 h-16 rounded-xl border border-ios-gray-4 bg-ios-gray-6 gap-1 px-1">
                {fileIcon(pf.file.type)}
                <span className="text-[10px] text-ios-gray-2 text-center leading-tight truncate w-full px-1">
                  {pf.file.name.length > 10 ? pf.file.name.slice(0, 8) + '…' : pf.file.name}
                </span>
              </div>
            )}
            <button
              onMouseDown={e => { e.preventDefault(); onRemove(i) }}
              className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-ios-gray-1 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ width: 18, height: 18 }}
            >
              <X size={10} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Message Input ─────────────────────────────────────────────────────────────

function MessageInput({
  channelId,
  workspaceId,
  currentUserName,
  allTasks,
  inputRef,
  onSent,
  onFileUploaded,
}: {
  channelId: string
  workspaceId: string
  currentUserName: string
  allTasks: Task[]
  inputRef?: React.MutableRefObject<{ addFiles: (files: FileList | File[]) => void } | null>
  onSent: (msg: ChatMessage) => void
  onFileUploaded: (msg: ChatMessage) => void
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [linkedTask, setLinkedTask] = useState<Task | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  // ! quick-task state
  const [bangOpen, setBangOpen] = useState(false)
  const [bangCreating, setBangCreating] = useState(false)
  const [bangFields, setBangFields] = useState<BangFields>({ title: '', description: '', dueDateRaw: '', priority: 'medium' })
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordingMs, setRecordingMs] = useState(0)
  const audioRecorderRef = useRef<AudioRecorderClient | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const slashPosRef = useRef<number>(-1)
  const bangPosRef = useRef<number>(-1)

  // Expose addFiles to parent via ref (for drag-and-drop)
  useEffect(() => {
    if (inputRef) inputRef.current = { addFiles }
  })

  // Cleanup object URLs and recording on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach(pf => pf.previewUrl && URL.revokeObjectURL(pf.previewUrl))
      if (audioRecorderRef.current?.isRecording) {
        audioRecorderRef.current.stop().catch(() => {})
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const emitTyping = useCallback(() => {
    chatApi.typing(channelId, currentUserName).catch(() => {})
  }, [channelId, currentUserName])

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    const pending: PendingFile[] = arr.map(f => ({
      file: f,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }))
    setPendingFiles(prev => [...prev, ...pending])
  }

  function removePendingFile(idx: number) {
    setPendingFiles(prev => {
      const pf = prev[idx]
      if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl)
      return prev.filter((_, i) => i !== idx)
    })
  }

  // Parse "!title !!description !!duedate !!priority" from text after bangPos
  function parseBangInline(val: string, bangPos: number): Partial<BangFields> {
    const raw = val.slice(bangPos + 1) // everything after the !
    const parts = raw.split(/\s*!!\s*/)
    const title = parts[0]?.trim() ?? ''
    const description = parts[1]?.trim() ?? ''
    const thirdPart = parts[2]?.trim() ?? ''
    const fourthPart = parts[3]?.trim() ?? ''

    // Detect if third part is a priority keyword or a date
    const PRIOS = ['low', 'medium', 'high', 'urgent']
    let dueDateRaw = thirdPart
    let priority: Task['priority'] = 'medium'

    if (PRIOS.includes(fourthPart.toLowerCase())) {
      priority = fourthPart.toLowerCase() as Task['priority']
    } else if (PRIOS.includes(thirdPart.toLowerCase())) {
      // third part is actually priority, no date
      priority = thirdPart.toLowerCase() as Task['priority']
      dueDateRaw = ''
    }

    return { title, description, dueDateRaw, priority }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setText(val)

    // ── Bang (!) handler ──────────────────────────────────────────────────────
    if (bangOpen) {
      const bangPos = bangPosRef.current
      if (bangPos >= 0 && val.length > bangPos) {
        // Live-parse inline syntax into popover fields
        const parsed = parseBangInline(val, bangPos)
        setBangFields(prev => ({ ...prev, ...parsed }))
      } else {
        closeBang()
      }
    } else {
      // Detect standalone ! at start or after whitespace
      const cursor = e.target.selectionStart ?? val.length
      if (val[cursor - 1] === '!' && (cursor === 1 || /[\s]/.test(val[cursor - 2]))) {
        bangPosRef.current = cursor - 1
        setBangFields({ title: '', description: '', dueDateRaw: '', priority: 'medium' })
        setBangOpen(true)
      }
    }

    // ── Slash (/) task picker ──────────────────────────────────────────────────
    if (pickerOpen) {
      const slashPos = slashPosRef.current
      if (slashPos >= 0 && val.length > slashPos) {
        const afterSlash = val.slice(slashPos + 1)
        if (afterSlash.includes(' ')) {
          setPickerOpen(false)
          slashPosRef.current = -1
        } else {
          setPickerQuery(afterSlash)
        }
      } else {
        setPickerOpen(false)
        slashPosRef.current = -1
      }
    } else if (!bangOpen) {
      const cursor = e.target.selectionStart ?? val.length
      if (val[cursor - 1] === '/' && (cursor === 1 || val[cursor - 2] === ' ' || val[cursor - 2] === '\n')) {
        slashPosRef.current = cursor - 1
        setPickerQuery('')
        setPickerOpen(true)
      }
    }

    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (bangOpen && e.key === 'Escape') {
      e.preventDefault()
      closeBang()
      return
    }
    if (pickerOpen && e.key === 'Escape') {
      e.preventDefault()
      closePicker()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      return
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(emitTyping, 400)
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items
    if (!items) return
    const fileItems = Array.from(items).filter(i => i.kind === 'file')
    if (!fileItems.length) return
    e.preventDefault()
    const files = fileItems.map(i => i.getAsFile()).filter(Boolean) as File[]
    addFiles(files)
  }

  function closeBang() {
    setBangOpen(false)
    bangPosRef.current = -1
    setBangFields({ title: '', description: '', dueDateRaw: '', priority: 'medium' })
    textareaRef.current?.focus()
  }

  async function handleBangSubmit() {
    if (!bangFields.title.trim() || bangCreating) return
    setBangCreating(true)
    try {
      const parsedDate = parseNaturalDate(bangFields.dueDateRaw)
      const created = await tasksApi.create({
        workspaceId,
        title: bangFields.title.trim(),
        description: bangFields.description.trim() || undefined,
        due_date: parsedDate,
        priority: bangFields.priority,
        status: 'todo',
        assignee_ids: [],
        labels: [],
        position: 0,
      })
      // Remove the !... text from textarea
      const bangPos = bangPosRef.current
      if (bangPos >= 0) {
        setText(prev => prev.slice(0, bangPos).trimEnd())
      }
      setLinkedTask(created)
      closeBang()
    } catch (err) {
      console.error('Task create failed', err)
    } finally {
      setBangCreating(false)
    }
  }

  function closePicker() {
    setPickerOpen(false)
    slashPosRef.current = -1
    setPickerQuery('')
    textareaRef.current?.focus()
  }

  function handleTaskSelect(task: Task) {
    const slashPos = slashPosRef.current
    if (slashPos >= 0) {
      const before = text.slice(0, slashPos)
      const after = text.slice(slashPos + 1 + pickerQuery.length)
      setText(before + after)
    }
    setLinkedTask(task)
    closePicker()
  }

  async function handleSend() {
    const body = text.trim()
    const hasContent = body || linkedTask || pendingFiles.length > 0
    if (!hasContent || sending) return

    setSending(true)
    const taskToSend = linkedTask
    const filesToSend = [...pendingFiles]
    const finalBody = body || (linkedTask ? linkedTask.title : '')

    setText('')
    setLinkedTask(null)
    setPendingFiles([])

    try {
      // Upload pending files first (each as its own message)
      for (const pf of filesToSend) {
        setUploading(true)
        try {
          const msg = await chatApi.upload(channelId, pf.file)
          onFileUploaded(msg)
        } finally {
          setUploading(false)
        }
      }

      // Send text message (if any text or linked task)
      if (finalBody) {
        const msg = await chatApi.send(channelId, finalBody, taskToSend?.id)
        onSent(msg)
      }
    } catch (e) {
      console.error('Send failed', e)
      setText(finalBody)
      setLinkedTask(taskToSend)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files?.length) addFiles(files)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleCameraInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files?.length) addFiles(files)
    if (cameraRef.current) cameraRef.current.value = ''
  }

  async function toggleRecording() {
    if (isRecording) {
      // Stop and upload
      try {
        const result = await audioRecorderRef.current!.stop()
        setIsRecording(false)
        setRecordingMs(0)
        if (result.blob.size > 0) {
          setUploading(true)
          try {
            const file = new File([result.blob], `voice-${Date.now()}.${result.mimeType.includes('mp4') ? 'm4a' : 'webm'}`, { type: result.mimeType })
            const msg = await chatApi.upload(channelId, file)
            onFileUploaded(msg)
          } finally {
            setUploading(false)
          }
        }
      } catch {
        setIsRecording(false)
        setRecordingMs(0)
      }
    } else {
      // Start recording
      try {
        audioRecorderRef.current = new AudioRecorderClient()
        await audioRecorderRef.current.start((ms) => setRecordingMs(ms))
        setIsRecording(true)
        setRecordingMs(0)
      } catch {
        setIsRecording(false)
      }
    }
  }

  const canSend = !!(text.trim() || linkedTask || pendingFiles.length > 0)
  const isBusy = sending || uploading

  return (
    <div className="shrink-0 border-t border-ios-gray-5 bg-white px-3 sm:px-4 py-2.5 sm:py-3">
      {/* Popovers (task picker / task creator) */}
      <div className="relative">
        {bangOpen && (
          <TaskCreatePopover
            fields={bangFields}
            onFieldChange={f => setBangFields(prev => ({ ...prev, ...f }))}
            onSubmit={handleBangSubmit}
            onClose={closeBang}
            creating={bangCreating}
          />
        )}
        {pickerOpen && !bangOpen && (
          <TaskPickerPopover
            query={pickerQuery}
            tasks={allTasks}
            onSelect={handleTaskSelect}
            onClose={closePicker}
          />
        )}
      </div>

      {/* Pending file thumbnails */}
      <PendingFileStrip files={pendingFiles} onRemove={removePendingFile} />

      {/* Linked task preview chip */}
      {linkedTask && (
        <div className="flex items-center gap-2 mb-2 px-0.5">
          <div className="flex items-center gap-2 bg-[var(--ws-color-light,#e8f4ff)] border border-[var(--ws-color,#007AFF)]/30 rounded-xl px-3 py-1.5 max-w-xs">
            <Circle size={9} className={cn('shrink-0', PRIORITY_COLOR[linkedTask.priority])} fill="currentColor" />
            <span className="text-xs font-medium text-[var(--ws-color,#007AFF)] truncate">{linkedTask.title}</span>
            <button
              onClick={() => setLinkedTask(null)}
              className="shrink-0 text-[var(--ws-color,#007AFF)] hover:text-ios-red transition-colors"
            >
              <X size={12} />
            </button>
          </div>
          <span className="text-[11px] text-ios-gray-3">Task will be attached to this message</span>
        </div>
      )}

      {/* Recording indicator bar */}
      {isRecording && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="w-2 h-2 rounded-full bg-ios-red animate-pulse" />
          <span className="text-xs font-mono font-medium text-ios-red">{formatDuration(recordingMs)}</span>
          <span className="text-xs text-ios-gray-2">Recording… tap mic to send</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File attachment button */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isBusy || isRecording}
          className="shrink-0 p-2 rounded-xl text-ios-gray-2 hover:text-ios-blue hover:bg-ios-gray-6 transition-colors disabled:opacity-40"
          title="Attach file (or drag & drop / paste)"
        >
          {uploading ? <Spinner size="sm" /> : <Paperclip size={18} />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv"
          multiple
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Camera button (mobile native camera capture) */}
        <button
          onClick={() => cameraRef.current?.click()}
          disabled={isBusy || isRecording}
          className="shrink-0 p-2 rounded-xl text-ios-gray-2 hover:text-ios-blue hover:bg-ios-gray-6 transition-colors disabled:opacity-40"
          title="Take photo or choose from library"
        >
          <Camera size={18} />
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleCameraInput}
        />

        {/* Text area (hidden while recording) */}
        {isRecording ? (
          <div className="flex-1 rounded-2xl border border-ios-red/40 bg-red-50 px-3.5 py-2 text-sm text-ios-red italic" style={{ minHeight: '38px' }}>
            🎙 Recording voice message…
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={linkedTask ? 'Add a message (optional)…' : 'Type ! to create a task · / to attach · paste or drag & drop files'}
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-ios-gray-4 bg-ios-gray-6 px-3.5 py-2 text-sm text-ios-label placeholder:text-ios-gray-3 focus:outline-none focus:border-[var(--ws-color,#007AFF)] focus:bg-white transition-colors leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: '38px' }}
          />
        )}

        {/* Send / Mic button — mic when idle+empty, send when has content, red mic when recording */}
        {isRecording ? (
          <button
            onClick={toggleRecording}
            disabled={uploading}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-ios-red text-white animate-pulse disabled:opacity-40 transition-all"
            title="Stop and send voice message"
          >
            <Mic size={16} />
          </button>
        ) : canSend ? (
          <button
            onClick={handleSend}
            disabled={isBusy}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-[var(--ws-color,#007AFF)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            title="Send"
          >
            {isBusy ? <Spinner size="sm" /> : <Send size={16} />}
          </button>
        ) : (
          <button
            onClick={toggleRecording}
            disabled={isBusy}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-ios-gray-5 text-ios-gray-2 hover:bg-ios-gray-4 disabled:opacity-40 transition-all"
            title="Record voice message"
          >
            <Mic size={16} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Channel Tab Bar (horizontal) ──────────────────────────────────────────────

function ChannelTabBar({
  channels,
  activeId,
  onSelect,
  onNew,
}: {
  channels: ChatChannel[]
  activeId: string | null
  onSelect: (ch: ChatChannel) => void
  onNew: () => void
}) {
  return (
    <div className="shrink-0 border-b border-ios-gray-5 bg-white flex items-center overflow-x-auto scrollbar-none">
      <div className="flex items-center gap-1 px-3 py-2 min-w-0">
        {channels.map(ch => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0',
              activeId === ch.id
                ? 'bg-[var(--ws-color,#007AFF)] text-white'
                : 'text-ios-secondary bg-ios-gray-6 hover:bg-ios-gray-5'
            )}
          >
            <Hash size={11} className="shrink-0 opacity-70" />
            {ch.name}
          </button>
        ))}
        <button
          onClick={onNew}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs text-ios-gray-2 bg-ios-gray-6 hover:bg-ios-gray-5 hover:text-ios-blue transition-colors shrink-0"
          title="New Channel"
        >
          <Plus size={12} />
          <span className="hidden sm:inline">New</span>
        </button>
      </div>
    </div>
  )
}

// ── New Channel Modal ─────────────────────────────────────────────────────────

function NewChannelModal({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string
  onClose: () => void
  onCreated: (ch: ChatChannel) => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setErr('Name required')
    setSaving(true)
    try {
      const ch = await chatApi.createChannel({ workspaceId, name: name.trim(), description: desc.trim() || undefined })
      onCreated(ch)
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open title="New Channel" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="text-sm text-ios-red bg-red-50 p-2 rounded-ios">{err}</p>}
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Name *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. issues, prayer, general" autoFocus />
        </div>
        <div>
          <label className="block text-xs font-medium text-ios-gray-2 mb-1">Description</label>
          <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ── Main ChatView ─────────────────────────────────────────────────────────────

export function ChatView() {
  const { activeWorkspace } = useWorkspace()
  const { user: authUser } = useAuth()
  const { subscribe } = useWs()

  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [users, setUsers] = useState<Map<string, AppUser>>(new Map())
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [newChannelOpen, setNewChannelOpen] = useState(false)
  const [typingLabel, setTypingLabel] = useState<string | null>(null)
  const [openTask, setOpenTask] = useState<Task | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragCounterRef = useRef(0)
  const inputRef = useRef<{ addFiles: (files: FileList | File[]) => void } | null>(null)
  const workspaceId = activeWorkspace?.id ?? ''

  // Load users once
  useEffect(() => {
    usersApi.list().then(({ users: list }) => {
      setUsers(new Map(list.map(u => [u.id, u])))
    }).catch(() => {})
  }, [])

  // Load tasks for task picker (refresh when workspace changes)
  useEffect(() => {
    if (!workspaceId) return
    tasksApi.list({ workspaceId }).then(({ tasks: list }) => {
      setAllTasks(list)
    }).catch(() => {})
  }, [workspaceId])

  // Load channels when workspace changes
  useEffect(() => {
    if (!workspaceId) return
    chatApi.channels(workspaceId).then(({ channels: list }) => {
      setChannels(list)
      if (list.length > 0 && !activeChannel) {
        setActiveChannel(list[0])
      }
    }).catch(console.error)
  }, [workspaceId])

  // Load messages when channel changes
  useEffect(() => {
    if (!activeChannel) return
    setLoading(true)
    setMessages([])
    chatApi.messages(activeChannel.id).then(({ messages: list }) => {
      setMessages(list)
      setHasMore(list.length >= 50)
      setTimeout(scrollToBottom, 50)
    }).catch(console.error).finally(() => setLoading(false))
  }, [activeChannel?.id])

  // WebSocket: new message
  useEffect(() => {
    const unsub = subscribe('chat.message', (e) => {
      const msg = e.payload.message as ChatMessage
      if (msg.channel_id === activeChannel?.id) {
        setMessages(prev => {
          // Deduplicate (optimistic sends)
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        setTimeout(scrollToBottom, 30)
      }
    })
    return unsub
  }, [activeChannel?.id, subscribe])

  // WebSocket: typing indicator
  useEffect(() => {
    const unsub = subscribe('chat.typing', (e) => {
      const { channelId, userId, name } = e.payload as { channelId: string; userId: string; name: string }
      if (channelId !== activeChannel?.id) return
      // Don't show own typing
      if (userId === authUser?.id) return
      setTypingLabel(`${name} is typing…`)
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => setTypingLabel(null), 3000)
    })
    return unsub
  }, [activeChannel?.id, authUser?.id, subscribe])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function loadMore() {
    if (!activeChannel || loadingMore || !hasMore || messages.length === 0) return
    setLoadingMore(true)
    const before = messages[0].created_at
    try {
      const { messages: older } = await chatApi.messages(activeChannel.id, before)
      setMessages(prev => [...older, ...prev])
      setHasMore(older.length >= 50)
    } finally {
      setLoadingMore(false)
    }
  }

  function handleScroll() {
    const el = scrollContainerRef.current
    if (!el) return
    if (el.scrollTop < 80) loadMore()
  }

  function handleMessageSent(msg: ChatMessage) {
    setMessages(prev => {
      if (prev.some(m => m.id === msg.id)) return prev
      return [...prev, msg]
    })
    setTimeout(scrollToBottom, 30)
  }

  function handlePinned(original: ChatMessage, taskId: string) {
    setMessages(prev => prev.map(m => m.id === original.id ? { ...m, task_id: taskId } : m))
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setDragOver(false)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) inputRef.current?.addFiles(files)
  }

  if (!workspaceId) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Chat" subtitle="Real-time messaging" accentColor="var(--ws-color,#007AFF)" />
        <div className="flex-1 flex items-center justify-center text-ios-gray-3">
          <div className="text-center">
            <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a workspace to start chatting</p>
          </div>
        </div>
      </div>
    )
  }

  const currentUserId = authUser?.id ?? ''
  const currentUserName = authUser?.user_metadata?.name ?? authUser?.email?.split('@')[0] ?? 'You'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        title="Chat"
        subtitle={activeChannel ? `#${activeChannel.name}` : activeWorkspace?.name ?? ''}
        accentColor="var(--ws-color,#007AFF)"
        actions={
          <Button size="sm" onClick={() => setNewChannelOpen(true)}>
            <Plus size={14} className="sm:mr-1" />
            <span className="hidden sm:inline">Channel</span>
          </Button>
        }
      />

      {/* Channel tab bar — horizontal, full width */}
      <ChannelTabBar
        channels={channels}
        activeId={activeChannel?.id ?? null}
        onSelect={ch => setActiveChannel(ch)}
        onNew={() => setNewChannelOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Main chat area */}
        <div
          className="flex flex-col flex-1 overflow-hidden bg-ios-gray-6/20 relative min-w-0"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag-and-drop overlay */}
          {dragOver && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[var(--ws-color,#007AFF)]/10 border-2 border-dashed border-[var(--ws-color,#007AFF)] rounded-none pointer-events-none">
              <UploadCloud size={40} className="text-[var(--ws-color,#007AFF)] mb-3" />
              <p className="text-sm font-semibold text-[var(--ws-color,#007AFF)]">Drop files to send</p>
              <p className="text-xs text-[var(--ws-color,#007AFF)]/70 mt-1">Images, PDFs, documents</p>
            </div>
          )}

          {!activeChannel ? (
            <div className="flex-1 flex items-center justify-center text-ios-gray-3">
              <p className="text-sm">Select a channel</p>
            </div>
          ) : (
            <>
              {/* Message list */}
              <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3"
              >
                {/* Load more indicator */}
                {loadingMore && (
                  <div className="flex justify-center py-2">
                    <Spinner size="sm" />
                  </div>
                )}

                {/* Load more button if there are older messages */}
                {hasMore && !loadingMore && messages.length > 0 && (
                  <div className="flex justify-center py-1">
                    <button
                      onClick={loadMore}
                      className="text-xs text-ios-blue hover:underline"
                    >
                      Load earlier messages
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="flex justify-center py-16">
                    <Spinner />
                  </div>
                )}

                {!loading && messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-ios-gray-3">
                    <Hash size={32} className="mb-3 opacity-30" />
                    <p className="text-sm font-medium">#{activeChannel.name}</p>
                    <p className="text-xs mt-1">No messages yet. Say hello!</p>
                  </div>
                )}

                {/* Messages with date separators + WhatsApp image grouping */}
                {(() => {
                  // Build groups: consecutive image-only messages from same sender within 5 min
                  type MsgGroup = { lead: ChatMessage; extras: ChatMessage[] }
                  const groups: MsgGroup[] = []
                  const skipped = new Set<string>()

                  for (let i = 0; i < messages.length; i++) {
                    if (skipped.has(messages[i].id)) continue
                    const msg = messages[i]
                    const isImageMsg = (m: ChatMessage) => !!m.file_type?.startsWith('image/') && !!m.file_url && !m.body
                    if (isImageMsg(msg)) {
                      const extras: ChatMessage[] = []
                      let j = i + 1
                      while (j < messages.length) {
                        const next = messages[j]
                        const sameUser = next.user_id === msg.user_id
                        const closeInTime = Math.abs(new Date(next.created_at).getTime() - new Date(msg.created_at).getTime()) < 5 * 60 * 1000
                        if (sameUser && closeInTime && isImageMsg(next)) {
                          extras.push(next)
                          skipped.add(next.id)
                          j++
                        } else break
                      }
                      groups.push({ lead: msg, extras })
                    } else {
                      groups.push({ lead: msg, extras: [] })
                    }
                  }

                  return groups.map(({ lead: msg, extras }, gi) => {
                    const prevMsg = gi > 0 ? groups[gi - 1].lead : null
                    const showDate = !prevMsg || !sameDay(prevMsg.created_at, msg.created_at)
                    const isOwn = msg.user_id === currentUserId
                    const user = users.get(msg.user_id)
                    const groupedImages = extras.length > 0
                      ? [{ url: msg.file_url!, name: msg.file_name || 'photo' }, ...extras.map(e => ({ url: e.file_url!, name: e.file_name || 'photo' }))]
                      : undefined

                    return (
                      <React.Fragment key={msg.id}>
                        {showDate && (
                          <div className="flex items-center gap-3 py-2">
                            <div className="flex-1 h-px bg-ios-gray-5" />
                            <span className="text-xs text-ios-gray-3 font-medium shrink-0">
                              {formatDateLabel(msg.created_at)}
                            </span>
                            <div className="flex-1 h-px bg-ios-gray-5" />
                          </div>
                        )}
                        <MessageBubble
                          msg={msg}
                          isOwn={isOwn}
                          user={user}
                          workspaceId={workspaceId}
                          channelId={activeChannel.id}
                          groupedImages={groupedImages}
                          onPinned={handlePinned}
                          onOpenTask={setOpenTask}
                        />
                      </React.Fragment>
                    )
                  })
                })()}

                {/* Typing indicator */}
                {typingLabel && (
                  <div className="flex items-center gap-2 px-1 pb-1">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-ios-gray-3 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-ios-gray-3 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-ios-gray-3 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-ios-gray-3 italic">{typingLabel}</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <MessageInput
                channelId={activeChannel.id}
                workspaceId={workspaceId}
                currentUserName={currentUserName}
                allTasks={allTasks}
                inputRef={inputRef}
                onSent={handleMessageSent}
                onFileUploaded={handleMessageSent}
              />
            </>
          )}
        </div>

        {/* Task detail panel — full overlay on mobile, side panel on desktop */}
        {openTask && (
          <div className="absolute inset-0 z-20 bg-white flex flex-col overflow-hidden md:relative md:inset-auto md:z-auto md:w-[400px] md:shrink-0 md:border-l md:border-ios-gray-5">
            <TaskDetailPanel
              task={openTask}
              onClose={() => setOpenTask(null)}
              onUpdate={(updated) => setOpenTask(updated)}
              onDelete={() => setOpenTask(null)}
            />
          </div>
        )}
      </div>

      {newChannelOpen && (
        <NewChannelModal
          workspaceId={workspaceId}
          onClose={() => setNewChannelOpen(false)}
          onCreated={(ch) => {
            setChannels(prev => [...prev, ch])
            setActiveChannel(ch)
            setNewChannelOpen(false)
          }}
        />
      )}
    </div>
  )
}
