import React from 'react'
import { FileText, Clock } from 'lucide-react'
import type { Transcript } from '@/lib/api'

interface TranscriptViewProps {
  transcript: Transcript
}

export function TranscriptView({ transcript }: TranscriptViewProps) {
  const minutes = Math.floor(transcript.words.length > 0
    ? (transcript.words[transcript.words.length - 1]?.end ?? 0) / 60
    : 0)

  return (
    <div className="bg-ios-gray-6 rounded-ios-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-ios-blue" />
        <span className="text-sm font-medium text-ios-label">Transcript</span>
        <span className="ml-auto text-xs text-ios-gray-1">
          {(transcript.confidence_score * 100).toFixed(0)}% confidence
        </span>
      </div>
      <p className="text-sm text-ios-label leading-relaxed whitespace-pre-wrap">
        {transcript.raw_text || 'No speech detected.'}
      </p>
    </div>
  )
}
