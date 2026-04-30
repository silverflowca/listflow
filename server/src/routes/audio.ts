import { Hono } from 'hono'
import { lf } from '../db/client.js'
import { supabase } from '../db/client.js'
import { requireAuth } from '../middleware/auth.js'
import { transcribeAudio } from '../lib/deepgram.js'
import { runAgent } from '../lib/agent.js'
import { emitTranscriptReady } from '../lib/ws.js'
import { mirrorToFileFlow } from '../lib/fileflow.js'
import { randomUUID } from 'crypto'

const r = new Hono()

// POST /api/audio/upload — multipart: audioFile, workspaceId, pageId?, taskId?
r.post('/upload', requireAuth, async (c) => {
  const user = c.get('user')
  const formData = await c.req.formData()

  const audioFile = formData.get('audioFile') as File | null
  const workspaceId = formData.get('workspaceId') as string | null
  const pageId = (formData.get('pageId') as string | null) ?? undefined
  const taskId = (formData.get('taskId') as string | null) ?? undefined

  if (!audioFile || !workspaceId) {
    return c.json({ error: 'audioFile and workspaceId are required' }, 400)
  }

  const buffer = Buffer.from(await audioFile.arrayBuffer())
  const filename = audioFile.name || `recording-${Date.now()}.webm`
  const mimeType = audioFile.type || 'audio/webm'
  const storagePath = `${workspaceId}/${randomUUID()}-${filename}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('listflow-audio')
    .upload(storagePath, buffer, { contentType: mimeType })

  if (uploadError) {
    console.error('[audio] Storage upload failed:', uploadError.message)
    // Continue even if storage fails — still transcribe
  }

  // Insert audio recording record
  const { data: recording, error: recErr } = await (lf('audio_recordings') as any)
    .insert({
      workspace_id: workspaceId,
      page_id: pageId ?? null,
      task_id: taskId ?? null,
      filename,
      storage_path: storagePath,
      duration_ms: null,
      size_bytes: buffer.byteLength,
      mime_type: mimeType,
      created_by: user.id,
    })
    .select()
    .single()

  if (recErr) return c.json({ error: recErr.message }, 500)

  // Transcribe with Deepgram
  let transcriptId: string | null = null
  let rawText = ''

  try {
    const result = await transcribeAudio(buffer, mimeType)
    rawText = result.rawText

    const { data: transcript } = await (lf('transcripts') as any)
      .insert({
        recording_id: recording.id,
        workspace_id: workspaceId,
        raw_text: rawText,
        confidence_score: result.confidenceScore,
        words: result.words,
        language: result.language,
      })
      .select()
      .single()

    if (transcript) {
      transcriptId = transcript.id
      emitTranscriptReady(recording.id, transcript.id, rawText)

      // Mirror to FileFlow async (fire-and-forget — never block the response)
      mirrorToFileFlow({
        audioBuffer: buffer,
        filename,
        mimeType,
        transcript: rawText,
        confidenceScore: result.confidenceScore,
        language: result.language,
        durationSeconds: result.durationSeconds,
        workspaceId,
        listflowRecordingId: recording.id,
        listflowTranscriptId: transcript.id,
      }).then(ff => {
        if (ff) console.log(`[fileflow] Mirrored recording ${recording.id} → FileFlow file ${ff.id}`)
      }).catch(err => console.warn('[fileflow] Mirror failed (non-fatal):', err))
    }
  } catch (err) {
    console.error('[audio] Transcription failed:', err)
    // Return partial success with error info
    return c.json({
      recordingId: recording.id,
      transcriptId: null,
      rawText: '',
      runId: null,
      error: `Transcription failed: ${String(err)}`,
    }, 207)
  }

  // Trigger AI agent if we have a transcript
  let runId: string | null = null
  if (rawText.length > 10 && transcriptId) {
    const { data: run } = await (lf('agent_runs') as any)
      .insert({
        workspace_id: workspaceId,
        transcript_id: transcriptId,
        prompt: `Process this speech transcript and extract action items:\n\n${rawText}`,
        status: 'running',
      })
      .select()
      .single()

    if (run) {
      runId = run.id
      // Run agent async (don't await — fire and forget)
      runAgent({
        runId: run.id,
        workspaceId,
        prompt: `Process this speech transcript and extract action items:\n\n${rawText}`,
        createdBy: user.id,
        transcriptId,
      }).catch((err) => console.error('[audio] Agent run failed:', err))
    }
  }

  return c.json({ recordingId: recording.id, transcriptId, rawText, runId })
})

// GET /api/audio/task/:taskId
r.get('/task/:taskId', requireAuth, async (c) => {
  const taskId = c.req.param('taskId')
  const { data, error } = await (lf('audio_recordings') as any)
    .select('*, transcripts(id, raw_text, confidence_score, created_at)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ recordings: data ?? [] })
})

// GET /api/audio?workspaceId=
r.get('/', requireAuth, async (c) => {
  const workspaceId = c.req.query('workspaceId')
  if (!workspaceId) return c.json({ error: 'workspaceId required' }, 400)

  const { data, error } = await (lf('audio_recordings') as any)
    .select('*, transcripts(id, raw_text, confidence_score, created_at)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ recordings: data })
})

// DELETE /api/audio/:id
r.delete('/:id', requireAuth, async (c) => {
  const { data, error } = await (lf('audio_recordings') as any)
    .select('storage_path')
    .eq('id', c.req.param('id'))
    .single()

  if (!error && data?.storage_path) {
    await supabase.storage.from('listflow-audio').remove([data.storage_path])
  }

  const { error: delErr } = await (lf('audio_recordings') as any)
    .delete()
    .eq('id', c.req.param('id'))

  if (delErr) return c.json({ error: delErr.message }, 500)
  return c.json({ ok: true })
})

export default r
