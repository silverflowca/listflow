export interface RecordingState {
  isRecording: boolean
  isPaused: boolean
  durationMs: number
  error: string | null
}

export class AudioRecorderClient {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null
  private startTime = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private onDurationUpdate: ((ms: number) => void) | null = null

  async start(onDurationUpdate?: (ms: number) => void): Promise<void> {
    this.onDurationUpdate = onDurationUpdate ?? null
    this.chunks = []

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType })
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }

    this.mediaRecorder.start(100) // collect chunks every 100ms
    this.startTime = Date.now()

    if (onDurationUpdate) {
      this.timer = setInterval(() => {
        onDurationUpdate(Date.now() - this.startTime)
      }, 100)
    }
  }

  stop(): Promise<{ blob: Blob; durationMs: number; mimeType: string }> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve({ blob: new Blob(), durationMs: 0, mimeType: 'audio/webm' })
        return
      }

      const durationMs = Date.now() - this.startTime
      const mimeType = this.mediaRecorder.mimeType

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: mimeType })
        this.cleanup()
        resolve({ blob, durationMs, mimeType })
      }

      this.mediaRecorder.stop()
    })
  }

  private cleanup(): void {
    if (this.timer) clearInterval(this.timer)
    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null
    this.mediaRecorder = null
    this.timer = null
  }

  get isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
