import React, { useCallback, useEffect, useRef, useState } from 'react'
import { X, Plus, Trash2, Mic, MicOff, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tasks as tasksApi, audio as audioApi, type Task, type Subtask, type Comment, type AudioRecording } from '@/lib/api'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface TaskDetailProps {
  task: Task
  onClose: () => void
  onUpdate: (task: Task) => void
  onDelete: () => void
}

// Relative time helper
function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function TaskDetail({ task, onClose, onUpdate, onDelete }: TaskDetailProps) {
  const { activeWorkspace } = useWorkspace()
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [subtasks, setSubtasks] = useState<Subtask[]>(task.subtasks ?? [])
  const [comments, setComments] = useState<Comment[]>(task.comments ?? [])
  const [recordings, setRecordings] = useState<AudioRecording[]>([])
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingComment, setAddingComment] = useState(false)
  const [uploadingAudio, setUploadingAudio] = useState(false)
  const [recording, setRecording] = useState(false)
  const [audioError, setAudioError] = useState('')
  const [expandedTranscripts, setExpandedTranscripts] = useState<Record<string, boolean>>({})

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load task recordings on mount
  useEffect(() => {
    audioApi.listByTask(task.id)
      .then(({ recordings: r }) => setRecordings(r))
      .catch(() => {})
  }, [task.id])

  const save = async () => {
    setSaving(true)
    const updated = await tasksApi.update(task.id, { title, description })
    onUpdate(updated)
    setSaving(false)
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

  const toggleSubtask = async (sub: Subtask) => {
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

  // Audio upload helper
  const uploadAudio = useCallback(async (blob: Blob, filename: string) => {
    if (!activeWorkspace) return
    setUploadingAudio(true)
    setAudioError('')
    try {
      const fd = new FormData()
      fd.append('audioFile', blob, filename)
      fd.append('workspaceId', activeWorkspace.id)
      fd.append('taskId', task.id)
      const result = await audioApi.upload(fd)
      if (result.recordingId) {
        // Refresh recordings list
        const { recordings: r } = await audioApi.listByTask(task.id)
        setRecordings(r)
      }
      if (result.error) setAudioError(result.error)
    } catch (err: any) {
      setAudioError(err.message)
    } finally {
      setUploadingAudio(false)
    }
  }, [activeWorkspace, task.id])

  // File picker upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await uploadAudio(file, file.name)
    e.target.value = ''
  }

  // Mic recording
  const startRecording = async () => {
    setAudioError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await uploadAudio(blob, `recording-${Date.now()}.webm`)
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch {
      setAudioError('Microphone access denied')
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    mediaRef.current = null
    setRecording(false)
  }

  const deleteRecording = async (id: string) => {
    await audioApi.delete(id)
    setRecordings(prev => prev.filter(r => r.id !== id))
  }

  const toggleTranscript = (id: string) => {
    setExpandedTranscripts(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const STATUSES: Task['status'][] = ['todo', 'in_progress', 'review', 'done', 'cancelled']
  const PRIORITIES: Task['priority'][] = ['low', 'medium', 'high', 'urgent']

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-ios-lg flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ios-gray-5 shrink-0">
          <StatusBadge status={task.status} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (confirm('Delete this task?')) onDelete() }}
              className="p-1.5 text-ios-red hover:bg-red-50 rounded-ios transition-colors"
            >
              <Trash2 size={16} />
            </button>
            <button onClick={onClose} className="p-1.5 text-ios-gray-1 hover:bg-ios-gray-6 rounded-ios transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Title */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={save}
            className="w-full text-xl font-semibold text-ios-label outline-none border-none bg-transparent"
            placeholder="Task title"
          />

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-ios-gray-1 mb-1">Status</p>
              <select
                value={task.status}
                onChange={e => changeStatus(e.target.value as Task['status'])}
                className="w-full text-sm rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 text-ios-label outline-none"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs text-ios-gray-1 mb-1">Priority</p>
              <select
                value={task.priority}
                onChange={e => changePriority(e.target.value as Task['priority'])}
                className="w-full text-sm rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 text-ios-label outline-none"
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs text-ios-gray-1 mb-1">Description</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={save}
              rows={3}
              className="w-full text-sm text-ios-label rounded-ios border border-ios-gray-4 px-3 py-2 bg-ios-gray-6 outline-none resize-none"
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
                    className="rounded accent-ios-blue"
                  />
                  <span className={cn('text-sm flex-1', sub.completed && 'line-through text-ios-gray-2')}>
                    {sub.title}
                  </span>
                  <button
                    onClick={() => deleteSubtask(sub.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-ios-red transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubtask()}
                className="flex-1 text-sm rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 outline-none"
                placeholder="Add subtask…"
              />
              <button onClick={addSubtask} className="p-2 bg-ios-blue text-white rounded-ios hover:bg-blue-600 transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* ── Audio ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-ios-gray-1">Audio & Transcripts</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAudio || recording}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-ios-gray-4 text-ios-gray-1 hover:bg-ios-gray-6 disabled:opacity-50 transition-colors"
                  title="Upload audio file"
                >
                  <Upload size={11} /> Upload
                </button>
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={uploadingAudio}
                  className={cn(
                    'flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors',
                    recording
                      ? 'border-ios-red bg-red-50 text-ios-red hover:bg-red-100'
                      : 'border-ios-gray-4 text-ios-gray-1 hover:bg-ios-gray-6'
                  )}
                  title={recording ? 'Stop recording' : 'Start recording'}
                >
                  {recording ? <MicOff size={11} /> : <Mic size={11} />}
                  {recording ? 'Stop' : 'Record'}
                </button>
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
              </div>
            </div>

            {uploadingAudio && (
              <p className="text-xs text-ios-blue mb-2 animate-pulse">Uploading & transcribing…</p>
            )}
            {recording && (
              <p className="text-xs text-ios-red mb-2 animate-pulse flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-ios-red inline-block animate-pulse" />
                Recording…
              </p>
            )}
            {audioError && (
              <p className="text-xs text-ios-red bg-red-50 rounded-lg px-2 py-1 mb-2">{audioError}</p>
            )}

            {recordings.length === 0 ? (
              <p className="text-xs text-ios-gray-3">No audio recordings yet.</p>
            ) : (
              <div className="space-y-2">
                {recordings.map(rec => {
                  const transcript = rec.transcripts?.[0]
                  const isExpanded = expandedTranscripts[rec.id]
                  return (
                    <div key={rec.id} className="bg-ios-gray-6 rounded-ios border border-ios-gray-5/60 p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-ios-label truncate">{rec.filename}</p>
                          <p className="text-xs text-ios-gray-3 mt-0.5">{relativeTime(rec.created_at)}</p>
                        </div>
                        {transcript && (
                          <button
                            onClick={() => toggleTranscript(rec.id)}
                            className="flex items-center gap-0.5 text-xs text-ios-blue hover:underline shrink-0"
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            Transcript
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm('Delete this recording?')) deleteRecording(rec.id) }}
                          className="p-1 text-ios-red hover:bg-red-50 rounded transition-colors shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {transcript && isExpanded && (
                        <div className="mt-2 pt-2 border-t border-ios-gray-5">
                          <p className="text-xs text-ios-gray-2 leading-relaxed whitespace-pre-wrap">{transcript.raw_text}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Comments ── */}
          <div>
            <p className="text-xs font-medium text-ios-gray-1 mb-2">
              Comments {comments.length > 0 && `(${comments.length})`}
            </p>

            {comments.length === 0 ? (
              <p className="text-xs text-ios-gray-3 mb-2">No comments yet.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-ios-gray-6 rounded-ios border border-ios-gray-5/60 p-3 group relative">
                    <p className="text-sm text-ios-label pr-6">{c.content}</p>
                    <p className="text-xs text-ios-gray-3 mt-1">{relativeTime(c.created_at)}</p>
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-ios-red hover:bg-red-50 rounded transition-opacity"
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
                className="flex-1 text-sm rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 outline-none"
                placeholder="Add comment…"
              />
              <button
                onClick={addComment}
                disabled={addingComment}
                className="p-2 bg-ios-blue text-white rounded-ios hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Local badges (avoid import cycle) ─────────────────────────────────────────

function StatusBadge({ status }: { status: Task['status'] }) {
  const map: Record<string, string> = {
    todo: 'bg-ios-gray-5 text-ios-gray-2',
    in_progress: 'bg-blue-100 text-ios-blue',
    review: 'bg-yellow-100 text-yellow-700',
    done: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-ios-red',
  }
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize', map[status] ?? map.todo)}>
      {status.replace('_', ' ')}
    </span>
  )
}
