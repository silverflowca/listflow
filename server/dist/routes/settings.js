import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { getConfig, setConfig, deleteConfig, configCache } from '../lib/config.js';
import { testFileFlowConnection } from '../lib/fileflow.js';
const r = new Hono();
// All known configurable settings
const ALL_SETTINGS = [
    { key: 'ANTHROPIC_API_KEY', label: 'Anthropic API Key', sensitive: true, section: 'ai' },
    { key: 'GEMINI_API_KEY', label: 'Google Gemini API Key', sensitive: true, section: 'ai' },
    { key: 'AI_PROVIDER', label: 'Active AI Provider', sensitive: false, section: 'ai' },
    { key: 'GEMINI_MODEL', label: 'Gemini Model', sensitive: false, section: 'ai' },
    { key: 'DEEPGRAM_API_KEY', label: 'Deepgram API Key', sensitive: true, section: 'stt' },
    { key: 'DEEPGRAM_MODEL', label: 'Deepgram STT Model', sensitive: false, section: 'stt' },
    { key: 'FILEFLOW_URL', label: 'FileFlow Server URL', sensitive: false, section: 'fileflow' },
    { key: 'FILEFLOW_EMAIL', label: 'FileFlow Login Email', sensitive: false, section: 'fileflow' },
    { key: 'FILEFLOW_PASSWORD', label: 'FileFlow Password', sensitive: true, section: 'fileflow' },
    { key: 'FILEFLOW_FOLDER_ID', label: 'FileFlow Folder ID (optional)', sensitive: false, section: 'fileflow' },
];
// GET /api/settings/models — live model lists for Gemini and Deepgram
r.get('/models', requireAuth, async (c) => {
    return c.json({
        gemini: [
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', group: 'Current' },
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', group: 'Current' },
            { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', group: 'Current' },
            { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', group: 'Preview' },
            { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)', group: 'Preview' },
            { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (Preview)', group: 'Preview' },
        ],
        deepgram: [
            { id: 'nova-3', label: 'Nova 3 — Best accuracy, 50+ languages', group: 'Nova-3' },
            { id: 'nova-3-medical', label: 'Nova 3 Medical — Healthcare/clinical', group: 'Nova-3' },
            { id: 'nova-2', label: 'Nova 2 — General, 35+ languages', group: 'Nova-2' },
            { id: 'nova-2-general', label: 'Nova 2 General', group: 'Nova-2' },
            { id: 'nova-2-meeting', label: 'Nova 2 Meeting — Conferencing', group: 'Nova-2' },
            { id: 'nova-2-phonecall', label: 'Nova 2 Phone Call', group: 'Nova-2' },
            { id: 'nova-2-medical', label: 'Nova 2 Medical — Clinical vocabulary', group: 'Nova-2' },
            { id: 'nova-2-conversationalai', label: 'Nova 2 Conversational AI', group: 'Nova-2' },
            { id: 'nova-2-finance', label: 'Nova 2 Finance', group: 'Nova-2' },
            { id: 'nova-2-video', label: 'Nova 2 Video', group: 'Nova-2' },
            { id: 'flux-general-en', label: 'Flux General EN — Conversational + turn detection', group: 'Flux' },
            { id: 'flux-general-multi', label: 'Flux General Multilingual', group: 'Flux' },
            { id: 'whisper', label: 'Whisper Medium (OpenAI via Deepgram)', group: 'Whisper' },
            { id: 'whisper-large', label: 'Whisper Large — Highest accuracy', group: 'Whisper' },
            { id: 'whisper-small', label: 'Whisper Small — Balanced', group: 'Whisper' },
        ],
    });
});
// GET /api/settings/status — quick check of configured providers
r.get('/status', requireAuth, async (c) => {
    const anthropicKey = await getConfig('ANTHROPIC_API_KEY');
    const geminiKey = await getConfig('GEMINI_API_KEY');
    const deepgramKey = await getConfig('DEEPGRAM_API_KEY');
    const fileflowUrl = await getConfig('FILEFLOW_URL');
    const fileflowEmail = await getConfig('FILEFLOW_EMAIL');
    const fileflowPassword = await getConfig('FILEFLOW_PASSWORD');
    return c.json({
        ai: {
            anthropic: !!anthropicKey,
            gemini: !!geminiKey,
            activeProvider: anthropicKey ? 'anthropic' : geminiKey ? 'gemini' : 'none',
        },
        stt: { deepgram: !!deepgramKey },
        fileflow: {
            configured: !!(fileflowUrl && fileflowEmail && fileflowPassword),
            url: fileflowUrl ?? null,
        },
    });
});
// POST /api/settings/fileflow/test — test connection to FileFlow
r.post('/fileflow/test', requireAuth, async (c) => {
    const body = await c.req.json();
    const url = body.url || await getConfig('FILEFLOW_URL');
    const email = body.email || await getConfig('FILEFLOW_EMAIL');
    const password = body.password || await getConfig('FILEFLOW_PASSWORD');
    if (!url || !email || !password)
        return c.json({ ok: false, error: 'URL, email and password are required' }, 400);
    const result = await testFileFlowConnection(url, email, password);
    return c.json(result);
});
// GET /api/settings — list all settings with masked sensitive values
r.get('/', requireAuth, async (c) => {
    const settings = await Promise.all(ALL_SETTINGS.map(async (s) => {
        const envValue = process.env[s.key];
        const dbValue = configCache.get(s.key);
        const resolvedValue = dbValue || envValue;
        return {
            key: s.key,
            label: s.label,
            section: s.section,
            sensitive: s.sensitive,
            hasValue: !!resolvedValue,
            source: dbValue ? 'override' : envValue ? 'env' : 'none',
            // Only expose value for non-sensitive settings
            value: s.sensitive ? (resolvedValue ? '***' : '') : (resolvedValue ?? ''),
        };
    }));
    return c.json({ settings });
});
// PATCH /api/settings/:key — set a config override
r.patch('/:key', requireAuth, async (c) => {
    const key = c.req.param('key') ?? '';
    const body = await c.req.json();
    const value = body.value ?? '';
    // Validate key is in allowed list
    const setting = ALL_SETTINGS.find(s => s.key === key);
    if (!setting)
        return c.json({ error: `Unknown setting: ${key}` }, 400);
    await setConfig(key, value);
    return c.json({
        key,
        source: 'override',
        hasValue: !!value,
        value: setting.sensitive ? '***' : value,
    });
});
// DELETE /api/settings/:key — remove override (falls back to env)
r.delete('/:key', requireAuth, async (c) => {
    const key = c.req.param('key') ?? '';
    await deleteConfig(key);
    const envValue = process.env[key] ?? undefined;
    const setting = ALL_SETTINGS.find(s => s.key === key);
    return c.json({
        key,
        source: envValue ? 'env' : 'none',
        hasValue: !!envValue,
        value: setting?.sensitive ? (envValue ? '***' : '') : (envValue ?? ''),
    });
});
export default r;
