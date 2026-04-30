import React from 'react'
import { Calendar, MessageSquare, CheckSquare } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge'
import type { Task } from '@/lib/api'

interface TaskCardProps {
  task: Task
  onClick?: () => void
  dragging?: boolean
}

export function TaskCard({ task, onClick, dragging }: TaskCardProps) {
  const completedSubtasks = task.subtasks?.filter(s => s.completed).length ?? 0
  const totalSubtasks = task.subtasks?.length ?? 0

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-ios p-3 shadow-ios cursor-pointer',
        'hover:shadow-ios-md transition-shadow duration-150',
        dragging && 'opacity-50 rotate-1',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-ios-label leading-snug flex-1">{task.title}</p>
        <StatusBadge status={task.status} />
      </div>

      {task.description && (
        <p className="text-xs text-ios-gray-1 mb-2 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center gap-3 text-xs text-ios-gray-1">
        <PriorityBadge priority={task.priority} />

        {task.due_date && (
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDate(task.due_date)}
          </span>
        )}

        {totalSubtasks > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare size={11} />
            {completedSubtasks}/{totalSubtasks}
          </span>
        )}

        {(task.comments?.length ?? 0) > 0 && (
          <span className="flex items-center gap-1">
            <MessageSquare size={11} />
            {task.comments!.length}
          </span>
        )}
      </div>

      {task.labels.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {task.labels.map(label => (
            <span key={label} className="text-xs bg-ios-gray-6 text-ios-gray-1 px-1.5 py-0.5 rounded-full">{label}</span>
          ))}
        </div>
      )}
    </div>
  )
}
