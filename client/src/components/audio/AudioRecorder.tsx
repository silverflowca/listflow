import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square, Upload, AlertCircle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AudioRecorderClient, formatDuration } from '@/lib/audio'
import { audio as audioApi } from '@/lib/api'
import { useWs } from '@/hooks/useWs'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface AudioRecorderProps {
  onTranscriptReady?: (transcriptId: string, rawText: string, runId: string | null) => void
  pageId?: string
  taskId?: string
}

type RecState = 'idle' | 'recording' | 'uploading' | 'done' | 'error'

export function AudioRecorder({ onTranscriptReady, pageId, taskId }: AudioRecorderProps) {
  const { activeWorkspace } = useWorkspace()
  const { subscribe } = useWs()
  const [state, setState] = useState<RecState>('idle')
  const [durationMs, setDurationMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<AudioRecorderClient | null>(null)

  // WS fallback — if server pushes transcript.ready before upload resolves
  useEffect(() => {
    return subscribe('transcript.ready', (evt) => {
      const { transcriptId, rawText } = evt.payload as { transcriptId: string; rawText: string }
      setState('done')
      onTranscriptReady?.(transcriptId, rawText, null)
    })
  }, [subscribe, onTranscriptReady])

  const reset = () => { setState('idle'); setError(null); setDurationMs(0) }

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      recorderRef.current = new AudioRecorderClient()
      await recorderRef.current.start((ms) => setDurationMs(ms))
      setState('recording')
    } catch {
      setError('Microphone access denied. Please allow microphone access.')
      setState('error')
    }
  }, [])

  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !activeWorkspace) return
    setState('uploading')

    // Safety: never stay stuck
    const timeout = setTimeout(() => setState(s => s === 'uploading' ? 'done' : s), 20000)

    try {
      const { blob, mimeType } = await recorderRef.current.stop()
      const formData = new FormData()
      const filename = `recording-${Date.now()}.${mimeType.includes('mp4') ? 'm4a' : 'webm'}`
      formData.append('audioFile', blob, filename)
      formData.append('workspaceId', activeWorkspace.id)
      if (pageId) formData.append('pageId', pageId)
      if (taskId) formData.append('taskId', taskId)

      const result = await audioApi.upload(formData)
      clearTimeout(timeout)
      if (result.error) throw new Error(result.error)

      setState('done')
      if (result.transcriptId) {
        onTranscriptReady?.(result.transcriptId, result.rawText ?? '', result.runId ?? null)
      }
    } catch (err) {
      clearTimeout(timeout)
      setError(String(err))
      setState('error')
    }
  }, [activeWorkspace, pageId, taskId, onTranscriptReady])

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Record button */}
      <div className="relative">
        {state === 'recording' && (
          <span className="absolute inset-0 rounded-full bg-ios-red opacity-30 animate-pulse-ring" />
        )}
        <button
          onClick={state === 'recording' ? stopRecording : state === 'idle' ? startRecording : undefined}
          disabled={state === 'uploading' || state === 'done'}
          className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-ios-md',
            state === 'recording' ? 'bg-ios-red text-white scale-110'
            : state === 'uploading' ? 'bg-ios-gray-5 text-ios-gray-2'
            : state === 'done' ? 'bg-ios-green text-white'
            : 'bg-ios-blue text-white hover:scale-105',
          )}
        >
          {state === 'recording' ? <Square size={28} fill="white" />
            : state === 'uploading' ? <Upload size={24} className="animate-bounce" />
            : state === 'done' ? <Check size={28} />
            : <Mic size={28} />}
        </button>
      </div>

      {/* Duration */}
      {state === 'recording' && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-ios-red animate-pulse" />
          <span className="text-sm font-mono font-medium text-ios-label">{formatDuration(durationMs)}</span>
        </div>
      )}

      {/* Label */}
      <p className="text-sm text-ios-gray-1">
        {state === 'idle' && 'Tap to record'}
        {state === 'recording' && 'Recording… tap to stop'}
        {state === 'uploading' && 'Uploading & transcribing…'}
        {state === 'done' && 'Transcript ready ✓'}
        {state === 'error' && 'Recording failed'}
      </p>

      {/* Record again */}
      {(state === 'done' || state === 'error') && (
        <button onClick={reset} className="text-xs text-ios-blue hover:underline">
          Record again
        </button>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-ios-red bg-red-50 rounded-ios px-3 py-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  )
}
