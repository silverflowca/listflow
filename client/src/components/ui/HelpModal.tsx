import React, { useState } from 'react'
import { X, CheckSquare, FileText, Mic, Settings, Users, ShieldCheck, Keyboard, Zap, MessageSquare, Database, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Section {
  id: string
  icon: React.ReactNode
  title: string
  color: string
  items: { label: string; desc: string }[]
}

const SECTIONS: Section[] = [
  {
    id: 'tasks',
    icon: <CheckSquare size={16} />,
    title: 'Tasks',
    color: 'text-ios-blue',
    items: [
      { label: 'Create a task', desc: 'Go to Tasks → click "+ New Task" in the top-right corner. Fill in title, status, and priority.' },
      { label: 'Change status / priority', desc: 'Open a task by clicking it. Use the Status and Priority dropdowns at the top of the detail panel.' },
      { label: 'Add subtasks', desc: 'Inside a task detail, scroll to Subtasks → type in the input field and press Enter or click +.' },
      { label: 'Filter tasks', desc: 'Use the Status and Priority filter dropdowns in the Tasks toolbar to narrow the board view.' },
      { label: 'Delete a task', desc: 'Open the task detail and click the red trash icon in the header.' },
    ],
  },
  {
    id: 'comments',
    icon: <MessageSquare size={16} />,
    title: 'Comments',
    color: 'text-ios-green',
    items: [
      { label: 'Add a comment', desc: 'Open a task → scroll to Comments → type in the text box and click Send (or press Ctrl+Enter).' },
      { label: 'Delete a comment', desc: 'Hover over a comment you wrote — a red trash button appears on the right. Click to remove it.' },
      { label: 'Timestamps', desc: 'Each comment shows a relative time ("2m ago", "3h ago") that refreshes automatically.' },
    ],
  },
  {
    id: 'audio',
    icon: <Mic size={16} />,
    title: 'Audio & AI',
    color: 'text-ios-purple',
    items: [
      { label: 'Record audio', desc: 'Go to Audio & AI → click the microphone button. Grant browser mic permission when prompted. Click Stop when finished.' },
      { label: 'Upload an audio file', desc: 'Click the upload button (arrow icon) next to the mic. Supports MP3, WAV, M4A, WEBM, and OGG.' },
      { label: 'View transcript', desc: 'After upload/recording, Deepgram automatically transcribes the audio. Click the chevron (›) next to any recording to expand its transcript.' },
      { label: 'Attach audio to a task', desc: 'Open a task detail → scroll to Audio & Transcripts → use the mic or upload button there. The recording is linked directly to that task.' },
      { label: 'Run AI agent', desc: 'On the Audio & AI page, scroll to the Agent panel. Type a prompt (e.g. "Summarize the last meeting") and click Run. The agent can read transcripts and create tasks.' },
      { label: 'Delete a recording', desc: 'Click the red trash icon next to any recording. This also removes the associated transcript.' },
    ],
  },
  {
    id: 'pages',
    icon: <FileText size={16} />,
    title: 'Pages & Blocks',
    color: 'text-ios-orange',
    items: [
      { label: 'Create a page', desc: 'Click the + icon next to "Pages" in the sidebar, or go to the Pages list and click "+ New Page".' },
      { label: 'Add blocks', desc: 'Click inside a page and type "/" to open the block type menu. Choose from Text, Heading, To-do, Bullet, Code, Divider, and more.' },
      { label: 'Reorder blocks', desc: 'Drag the ⠿ handle that appears on the left of any block when you hover over it.' },
      { label: 'Change block type', desc: 'Click the ⋮ menu icon on the block and select a new type, or type "/" at the start of a block.' },
      { label: 'Delete a block', desc: 'Click the ⋮ menu on the block → Delete, or press Backspace on an empty block.' },
      { label: 'Page icon & title', desc: 'Click the emoji icon at the top of a page to change it. Click the page title to rename it inline.' },
    ],
  },
  {
    id: 'databases',
    icon: <Database size={16} />,
    title: 'Databases',
    color: 'text-ios-teal',
    items: [
      { label: 'Create a database', desc: 'On a page, add a block and choose "Database". Give it a name and define columns (text, number, select, date, checkbox…).' },
      { label: 'Add entries', desc: 'Click "+ Add Row" in the database view. Fill in each field inline.' },
      { label: 'Edit schema', desc: 'Click the schema/settings icon on the database block to add, rename, or remove columns.' },
      { label: 'Filter & sort entries', desc: 'Use the filter bar above the database to show only rows matching a value in a specific column.' },
    ],
  },
  {
    id: 'workspaces',
    icon: <Settings size={16} />,
    title: 'Workspaces',
    color: 'text-ios-gray-1',
    items: [
      { label: 'Create a workspace', desc: 'Click "+ Add Workspace" in the sidebar, or go to the Workspaces page. Choose Personal or Group type.' },
      { label: 'Switch workspace', desc: 'Click any workspace name in the sidebar to make it active. All pages, tasks, and audio are scoped to the active workspace.' },
      { label: 'Rename / delete', desc: 'Go to the Workspaces page and click the edit icon next to any workspace you own.' },
      { label: 'Add members', desc: 'On the Workspaces page, select a group workspace and click "Manage Members" to invite users by user ID.' },
    ],
  },
  {
    id: 'admin',
    icon: <Users size={16} />,
    title: 'Users & Groups',
    color: 'text-purple-600',
    items: [
      { label: 'Invite a user', desc: 'Go to Admin → Users → click "+ Add User". Provide email, name, and role (admin, manager, member, viewer, guest).' },
      { label: 'Change a user\'s role', desc: 'In the Users list, click the role badge next to the user and pick a new role from the dropdown.' },
      { label: 'Suspend / remove a user', desc: 'Open the user row actions menu (⋮) → Suspend or Remove. Suspended users cannot log in but their data is retained.' },
      { label: 'Create a group', desc: 'Go to Admin → Groups → "+ New Group". Assign a name, color, and icon. Then add members from the user list.' },
      { label: 'Group roles', desc: 'Each group member can be a Lead or Member. Leads can manage the group membership.' },
    ],
  },
  {
    id: 'permissions',
    icon: <ShieldCheck size={16} />,
    title: 'Permissions Matrix',
    color: 'text-purple-600',
    items: [
      { label: 'What is the config matrix?', desc: 'A grid of features × roles. Each cell toggles whether a role (admin, manager, member…) can access a feature.' },
      { label: 'Toggle a permission', desc: 'Go to Admin → Permissions. Click any green ✓ or grey — cell to flip the permission for that feature+role combination.' },
      { label: 'Bulk apply', desc: 'Use the row header to enable/disable a feature for all roles at once.' },
    ],
  },
  {
    id: 'settings',
    icon: <Settings size={16} />,
    title: 'Settings & API Keys',
    color: 'text-ios-gray-1',
    items: [
      { label: 'AI provider', desc: 'Go to Settings → AI. Enter your Anthropic API key (for the AI agent) and/or Gemini API key.' },
      { label: 'Speech-to-text', desc: 'Settings → Speech-to-Text. Enter your Deepgram API key for automatic audio transcription.' },
      { label: 'FileFlow integration', desc: 'Settings → FileFlow. Enter your FileFlow server URL, email, and password to enable file linking. Use "Test Connection" to verify.' },
      { label: 'Override vs environment', desc: 'Keys shown with "override" source are stored in the DB. Keys with "env" source come from the server environment and cannot be edited in the UI.' },
    ],
  },
  {
    id: 'shortcuts',
    icon: <Keyboard size={16} />,
    title: 'Keyboard Shortcuts',
    color: 'text-ios-blue',
    items: [
      { label: '/ in a page', desc: 'Opens the block type picker at the current cursor position.' },
      { label: 'Enter on empty block', desc: 'Creates a new block below the current one.' },
      { label: 'Backspace on empty block', desc: 'Deletes the block.' },
      { label: 'Ctrl + Enter (comment box)', desc: 'Submits a comment without clicking the Send button.' },
      { label: 'Escape', desc: 'Closes any open modal, detail panel, or dropdown menu.' },
    ],
  },
  {
    id: 'tips',
    icon: <Zap size={16} />,
    title: 'Tips & Tricks',
    color: 'text-ios-orange',
    items: [
      { label: 'Audio → tasks', desc: 'Record a meeting note, then run the AI agent with "Create tasks from this transcript" — it will auto-generate tasks from the action items it finds.' },
      { label: 'Task + audio link', desc: 'Recordings attached inside a task detail are scoped to that task, making it easy to keep meeting notes with their follow-up actions.' },
      { label: 'Page as meeting notes', desc: 'Create a Page per meeting. Use H1/H2 headings for agenda items, bullet blocks for notes, and todo blocks for action items.' },
      { label: 'Workspace per project', desc: 'Use separate workspaces to keep projects isolated — each has its own pages, tasks, and recordings.' },
      { label: 'Collapsed sidebar', desc: 'Click the « arrow to collapse the sidebar to icons-only mode for more screen space on smaller displays.' },
    ],
  },
]

interface AccordionSectionProps {
  section: Section
  open: boolean
  onToggle: () => void
}

function AccordionSection({ section, open, onToggle }: AccordionSectionProps) {
  return (
    <div className="border border-ios-gray-5 rounded-ios overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 bg-white hover:bg-ios-gray-6 transition-colors text-left"
      >
        <span className={cn('shrink-0', section.color)}>{section.icon}</span>
        <span className="flex-1 text-sm font-medium text-ios-label">{section.title}</span>
        {open
          ? <ChevronDown size={15} className="text-ios-gray-1 shrink-0" />
          : <ChevronRight size={15} className="text-ios-gray-1 shrink-0" />
        }
      </button>
      {open && (
        <div className="divide-y divide-ios-gray-5 border-t border-ios-gray-5">
          {section.items.map(item => (
            <div key={item.label} className="px-4 py-3 bg-ios-gray-6/40">
              <div className="text-xs font-semibold text-ios-label mb-0.5">{item.label}</div>
              <div className="text-xs text-ios-gray-1 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

export function HelpModal({ open, onClose }: HelpModalProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['tasks']))

  if (!open) return null

  const toggle = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const expandAll = () => setOpenSections(new Set(SECTIONS.map(s => s.id)))
  const collapseAll = () => setOpenSections(new Set())

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:mx-4 sm:max-w-2xl bg-white rounded-t-ios-xl sm:rounded-ios-xl shadow-ios-lg animate-slide-up sm:animate-fade-in flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ios-gray-5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-ios-blue rounded-ios flex items-center justify-center">
              <CheckSquare size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ios-label leading-tight">ListFlow Help</h2>
              <p className="text-xs text-ios-gray-1">How to use every feature</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-ios-gray-6 text-ios-gray-1 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Expand / Collapse all */}
        <div className="flex items-center gap-3 px-5 py-2 border-b border-ios-gray-5 shrink-0">
          <button onClick={expandAll} className="text-xs text-ios-blue hover:underline">Expand all</button>
          <span className="text-ios-gray-4 text-xs">·</span>
          <button onClick={collapseAll} className="text-xs text-ios-blue hover:underline">Collapse all</button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
          {SECTIONS.map(section => (
            <AccordionSection
              key={section.id}
              section={section}
              open={openSections.has(section.id)}
              onToggle={() => toggle(section.id)}
            />
          ))}

          {/* Footer note */}
          <p className="text-xs text-ios-gray-2 text-center pt-2 pb-1">
            ListFlow — workspace notes, tasks, audio & AI in one place.
          </p>
        </div>
      </div>
    </div>
  )
}
