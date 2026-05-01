/**
 * FileFlow integration — mirrors audio recordings + transcripts into FileFlow.
 *
 * Flow:
 *  1. Login to FileFlow with configured credentials → get access_token
 *  2. Request a signed upload URL from FileFlow
 *  3. PUT the audio buffer directly to Supabase Storage via the signed URL
 *  4. POST /api/files to create the file record in FileFlow (with transcript in metadata)
 *  5. Optionally: POST /api/files to create a companion .txt transcript file
 */
import { getConfig } from './config.js';
// Cache the token for up to 55 minutes (Supabase sessions last 1hr)
let cachedToken = null;
let tokenExpiry = 0;
async function getToken(baseUrl, email, password) {
    if (cachedToken && Date.now() < tokenExpiry)
        return cachedToken;
    const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok)
        throw new Error(`FileFlow login failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    cachedToken = data.session.access_token;
    tokenExpiry = Date.now() + 55 * 60 * 1000;
    return cachedToken;
}
/** Invalidate cached token (e.g. after 401) */
function invalidateToken() {
    cachedToken = null;
    tokenExpiry = 0;
}
/**
 * Upload an audio buffer + transcript to FileFlow.
 * Returns the created FileFlow file record, or null if FileFlow is not configured.
 */
export async function mirrorToFileFlow(opts) {
    const [baseUrl, email, password, folderId] = await Promise.all([
        getConfig('FILEFLOW_URL'),
        getConfig('FILEFLOW_EMAIL'),
        getConfig('FILEFLOW_PASSWORD'),
        getConfig('FILEFLOW_FOLDER_ID'),
    ]);
    if (!baseUrl || !email || !password) {
        return null; // FileFlow not configured — silent skip
    }
    let token;
    try {
        token = await getToken(baseUrl, email, password);
    }
    catch (err) {
        console.warn('[fileflow] Auth failed:', err);
        return null;
    }
    const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
    // Step 1: Get a signed upload URL from FileFlow
    const urlRes = await fetch(`${baseUrl}/api/files/upload-url`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            fileName: opts.filename,
            fileType: opts.mimeType,
            folderId: folderId || null,
        }),
    });
    if (urlRes.status === 401) {
        invalidateToken();
        throw new Error('FileFlow auth expired — will retry on next upload');
    }
    if (!urlRes.ok)
        throw new Error(`FileFlow upload-url failed: ${urlRes.status}`);
    const { uploadUrl, storagePath } = await urlRes.json();
    // Step 2: PUT audio buffer to the signed Supabase URL
    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': opts.mimeType },
        body: opts.audioBuffer,
    });
    if (!putRes.ok)
        throw new Error(`FileFlow storage PUT failed: ${putRes.status}`);
    const fileExt = opts.filename.split('.').pop() ?? 'webm';
    // Step 3: Create the file record in FileFlow with transcript in metadata
    const fileRes = await fetch(`${baseUrl}/api/files`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
            name: opts.filename,
            original_name: opts.filename,
            mime_type: opts.mimeType,
            file_type: 'audio',
            file_extension: fileExt,
            size_bytes: opts.audioBuffer.byteLength,
            folder_id: folderId || null,
            storage_path: storagePath,
            bucket_name: 'files',
            upload_status: 'completed',
            duration_seconds: Math.round(opts.durationSeconds),
            metadata: {
                source: 'listflow',
                listflow_workspace_id: opts.workspaceId,
                listflow_recording_id: opts.listflowRecordingId,
                listflow_transcript_id: opts.listflowTranscriptId,
                transcript: opts.transcript,
                transcript_confidence: opts.confidenceScore,
                transcript_language: opts.language,
            },
        }),
    });
    if (!fileRes.ok)
        throw new Error(`FileFlow create file record failed: ${fileRes.status}`);
    const fileRecord = await fileRes.json();
    // Step 4: Also upload transcript as a companion .txt file (for easy viewing in FileFlow)
    if (opts.transcript) {
        try {
            const txtFilename = opts.filename.replace(/\.[^.]+$/, '') + '-transcript.txt';
            const txtBuffer = Buffer.from(opts.transcript, 'utf-8');
            const txtUrlRes = await fetch(`${baseUrl}/api/files/upload-url`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ fileName: txtFilename, fileType: 'text/plain', folderId: folderId || null }),
            });
            if (txtUrlRes.ok) {
                const { uploadUrl: txtUrl, storagePath: txtPath } = await txtUrlRes.json();
                const txtPut = await fetch(txtUrl, { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: txtBuffer });
                if (txtPut.ok) {
                    await fetch(`${baseUrl}/api/files`, {
                        method: 'POST',
                        headers: authHeaders,
                        body: JSON.stringify({
                            name: txtFilename,
                            original_name: txtFilename,
                            mime_type: 'text/plain',
                            file_type: 'document',
                            file_extension: 'txt',
                            size_bytes: txtBuffer.byteLength,
                            folder_id: folderId || null,
                            storage_path: txtPath,
                            bucket_name: 'files',
                            upload_status: 'completed',
                            metadata: {
                                source: 'listflow',
                                is_transcript: true,
                                audio_file_id: fileRecord.id,
                                listflow_recording_id: opts.listflowRecordingId,
                            },
                        }),
                    });
                }
            }
        }
        catch (err) {
            console.warn('[fileflow] Transcript .txt upload failed (non-fatal):', err);
        }
    }
    return fileRecord;
}
/**
 * Test connection to FileFlow — returns true if login succeeds.
 */
export async function testFileFlowConnection(baseUrl, email, password) {
    try {
        invalidateToken();
        await getToken(baseUrl, email, password);
        return { ok: true };
    }
    catch (err) {
        return { ok: false, error: String(err) };
    }
}
