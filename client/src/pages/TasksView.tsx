import React, { useCallback, useEffect, useState } from 'react'
import { Plus, LayoutGrid, List } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Textarea } from '@/components/ui/Input'
import { TaskBoard } from '@/components/tasks/TaskBoard'
import { TaskDetail } from '@/components/tasks/TaskDetail'
import { Spinner } from '@/components/ui/Spinner'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useWs } from '@/hooks/useWs'
import { tasks as tasksApi, type Task } from '@/lib/api'

export function TasksView() {
  const { activeWorkspace } = useWorkspace()
  const { subscribe } = useWs()
  const [taskList, setTaskList] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [view, setView] = useState<'board' | 'list'>('board')
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState<{ open: boolean; status: Task['status'] }>({ open: false, status: 'todo' })
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as Task['priority'] })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!activeWorkspace) return
    const { tasks } = await tasksApi.list({ workspaceId: activeWorkspace.id })
    setTaskList(tasks)
    setLoading(false)
  }, [activeWorkspace?.id])

  useEffect(() => { load() }, [load])

  // Real-time updates
  useEffect(() => {
    const unsubs = [
      subscribe('task.created', (evt) => {
        const task = evt.payload.task as Task
        if (task.workspace_id === activeWorkspace?.id) {
          setTaskList(prev => [task, ...prev])
        }
      }),
      subscribe('task.updated', (evt) => {
        const task = evt.payload.task as Task
        setTaskList(prev => prev.map(t => t.id === task.id ? task : t))
      }),
    ]
    return () => unsubs.forEach(u => u())
  }, [subscribe, activeWorkspace?.id])

  const handleTaskUpdate = useCallback(async (id: string, updates: Partial<Task>) => {
    const updated = await tasksApi.update(id, updates)
    setTaskList(prev => prev.map(t => t.id === id ? updated : t))
  }, [])

  const handleCreate = async () => {
    if (!activeWorkspace || !form.title.trim()) return
    setCreating(true)
    const task = await tasksApi.create({
      workspaceId: activeWorkspace.id,
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: createModal.status,
      assignee_ids: [],
      labels: [],
      position: 0,
    })
    setTaskList(prev => [task, ...prev])
    setCreateModal({ open: false, status: 'todo' })
    setForm({ title: '', description: '', priority: 'medium' })
    setCreating(false)
  }

  const handleDelete = async (taskId: string) => {
    await tasksApi.delete(taskId)
    setTaskList(prev => prev.filter(t => t.id !== taskId))
    setSelectedTask(null)
  }

  if (!activeWorkspace) return <div className="p-6 text-ios-gray-1 text-sm">Select a workspace</div>

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Tasks"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setView('board')} className={`p-2 rounded-ios ${view === 'board' ? 'bg-ios-blue text-white' : 'text-ios-gray-1 hover:bg-ios-gray-5'}`}>
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setView('list')} className={`p-2 rounded-ios ${view === 'list' ? 'bg-ios-blue text-white' : 'text-ios-gray-1 hover:bg-ios-gray-5'}`}>
              <List size={16} />
            </button>
            <Button size="sm" onClick={() => setCreateModal({ open: true, status: 'todo' })}>
              <Plus size={14} />
              New Task
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex justify-center pt-12"><Spinner /></div>
        ) : view === 'board' ? (
          <TaskBoard
            tasks={taskList}
            onTaskClick={setSelectedTask}
            onTaskCreate={(status) => setCreateModal({ open: true, status })}
            onTaskUpdate={handleTaskUpdate}
          />
        ) : (
          <div className="p-6 space-y-2">
            {taskList.map(task => (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="flex items-center gap-3 bg-white rounded-ios px-4 py-3 shadow-ios cursor-pointer hover:shadow-ios-md transition-shadow"
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${task.priority === 'urgent' ? 'bg-ios-red' : task.priority === 'high' ? 'bg-ios-orange' : task.priority === 'medium' ? 'bg-ios-blue' : 'bg-ios-gray-3'}`} />
                <span className="text-sm text-ios-label flex-1">{task.title}</span>
                <span className="text-xs text-ios-gray-1 capitalize">{task.status.replace('_', ' ')}</span>
              </div>
            ))}
            {taskList.length === 0 && (
              <div className="text-center py-12 text-ios-gray-1 text-sm">No tasks yet</div>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      <Modal
        open={createModal.open}
        onClose={() => setCreateModal({ open: false, status: 'todo' })}
        title="New Task"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateModal({ open: false, status: 'todo' })}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating} disabled={!form.title.trim()}>Create Task</Button>
          </>
        }
      >
        <div className="space-y-4">
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
              className="w-full mt-1 text-sm rounded-ios border border-ios-gray-4 px-2 py-1.5 bg-ios-gray-6 text-ios-label outline-none"
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
            setTaskList(prev => prev.map(t => t.id === updated.id ? updated : t))
            setSelectedTask(updated)
          }}
          onDelete={() => handleDelete(selectedTask.id)}
        />
      )}
    </div>
  )
}
