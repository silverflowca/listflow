import React from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/Badge'
import { TaskCard } from './TaskCard'
import { tasks as tasksApi, type Task } from '@/lib/api'

const STATUSES: Task['status'][] = ['todo', 'in_progress', 'review', 'done']

interface TaskBoardProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onTaskCreate: (status: Task['status']) => void
  onTaskUpdate: (id: string, updates: Partial<Task>) => void
}

export function TaskBoard({ tasks, onTaskClick, onTaskCreate, onTaskUpdate }: TaskBoardProps) {
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

  const handleDrop = (e: React.DragEvent, status: Task['status']) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) {
      onTaskUpdate(taskId, { status })
    }
  }

  return (
    <div className="flex gap-4 p-6 h-full overflow-x-auto">
      {STATUSES.map(status => {
        const columnTasks = tasks.filter(t => t.status === status)
        return (
          <div
            key={status}
            className="flex-shrink-0 w-72 flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <StatusBadge status={status} />
                <span className="text-xs text-ios-gray-1 font-medium">{columnTasks.length}</span>
              </div>
              <button
                onClick={() => onTaskCreate(status)}
                className="p-1 rounded hover:bg-ios-gray-5 text-ios-gray-1 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 min-h-20">
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
                >
                  <TaskCard task={task} onClick={() => onTaskClick(task)} />
                </div>
              ))}

              {columnTasks.length === 0 && (
                <div className="border-2 border-dashed border-ios-gray-4 rounded-ios p-4 text-center text-xs text-ios-gray-2">
                  Drop here
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
