import React, { useEffect, useRef, useState } from 'react'
import { Mic, Trash2, Clock, Play, Pause, ChevronDown, ChevronUp } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { AudioRecorder } from '@/components/audio/AudioRecorder'
import { AgentPanel } from '@/components/audio/AgentPanel'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { audio as audioApi, type AudioRecording } from '@/lib/api'
import { formatRelative } from '@/lib/utils'

// ── Inline audio player ───────────────────────────────────────
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause() } else { el.play() }
    setPlaying(!playing)
  }

  return (
    <div className="flex items-center gap-3 mt-2 bg-ios-gray-6 rounded-ios px-3 py-2">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={e => setProgress((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={e => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => setPlaying(false)}
      />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-ios-blue text-white flex items-center justify-center shrink-0 hover:bg-ios-blue/90 transition-colors"
      >
        {playing ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={0.1}
        value={progress}
        onChange={e => {
          const t = Number(e.target.value)
          if (audioRef.current) audioRef.current.currentTime = t
          setProgress(t)
        }}
        className="flex-1 accent-ios-blue h-1.5 cursor-pointer"
      />
      <span className="text-xs text-ios-gray-1 font-mono shrink-0">
        {fmt(progress)} / {fmt(duration)}
      </span>
    </div>
  )
}

// ── Recording card with expand/collapse ───────────────────────
function RecordingCard({ rec, onDelete }: { rec: AudioRecording; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const transcript = rec.transcripts?.[0]

  // Build a playable URL from storage_path (Supabase public URL pattern)
  const audioSrc = rec.storage_path
    ? `${import.meta.env.VITE_SUPABASE_URL ?? 'http://localhost:55321'}/storage/v1/object/public/listflow-audio/${rec.storage_path.replace('listflow-audio/', '')}`
    : null

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Mic size={14} className="text-ios-gray-1 shrink-0" />
            <p className="text-sm font-medium text-ios-label truncate">{rec.filename}</p>
            {rec.duration_ms && (
              <span className="text-xs text-ios-gray-2 shrink-0">
                {Math.round(rec.duration_ms / 1000)}s
              </span>
            )}
          </div>
          <p className="text-xs text-ios-gray-1 mt-0.5">{formatRelative(rec.created_at)}</p>

          {/* Transcript preview */}
          {transcript && (
            <p className="text-xs text-ios-secondary mt-1.5 line-clamp-2">{transcript.raw_text}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {(transcript || audioSrc) && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 text-ios-gray-1 hover:text-ios-blue hover:bg-blue-50 rounded-ios transition-colors"
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 text-ios-gray-1 hover:text-ios-red hover:bg-red-50 rounded-ios transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded: player + full transcript */}
      {expanded && (
        <div className="mt-3 space-y-3">
          {audioSrc && <AudioPlayer src={audioSrc} />}

          {transcript && (
            <div className="bg-blue-50 rounded-ios p-3">
              <p className="text-xs font-semibold text-ios-blue mb-1.5">Transcript</p>
              <p className="text-sm text-ios-label leading-relaxed whitespace-pre-wrap">{transcript.raw_text}</p>
              {transcript.confidence_score > 0 && (
                <p className="text-xs text-ios-gray-1 mt-2">
                  Confidence: {Math.round(transcript.confidence_score * 100)}%
                  {transcript.language && ` · Language: ${transcript.language}`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────
export function AudioView() {
  const { activeWorkspace } = useWorkspace()
  const [recordings, setRecordings] = useState<AudioRecording[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTranscript, setActiveTranscript] = useState<{ id: string; text: string } | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)

  const loadRecordings = async () => {
    if (!activeWorkspace) return
    try {
      const { recordings } = await audioApi.list(activeWorkspace.id)
      setRecordings(recordings)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadRecordings() }, [activeWorkspace?.id])

  const handleTranscriptReady = (transcriptId: string, rawText: string, runId: string | null) => {
    setActiveTranscript({ id: transcriptId, text: rawText })
    if (runId) setActiveRunId(runId)
    // Reload library to show new recording
    loadRecordings()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recording?')) return
    await audioApi.delete(id)
    setRecordings(prev => prev.filter(r => r.id !== id))
  }

  if (!activeWorkspace) return <div className="p-6 text-ios-gray-1 text-sm">Select a workspace</div>

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Audio & AI" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Recorder */}
        <Card className="p-8">
          <h2 className="text-sm font-semibold text-ios-label mb-6 text-center">Voice Recording</h2>
          <AudioRecorder onTranscriptReady={handleTranscriptReady} />
        </Card>

        {/* Latest transcript + agent panel */}
        {activeTranscript && (
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-ios-lg p-4">
              <p className="text-xs font-semibold text-ios-blue mb-2">Latest Transcript</p>
              <p className="text-sm text-ios-label leading-relaxed whitespace-pre-wrap">{activeTranscript.text}</p>
            </div>
            {activeRunId && <AgentPanel runId={activeRunId} />}
          </div>
        )}

        {/* Recording library */}
        <div>
          <h2 className="text-sm font-semibold text-ios-label mb-3 flex items-center gap-2">
            <Clock size={16} />
            Recording Library
          </h2>

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-8 text-ios-gray-1 text-sm">
              <Mic size={32} className="mx-auto mb-2 text-ios-gray-3" />
              No recordings yet
            </div>
          ) : (
            <div className="space-y-2">
              {recordings.map(rec => (
                <RecordingCard
                  key={rec.id}
                  rec={rec}
                  onDelete={() => handleDelete(rec.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
