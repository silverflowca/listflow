/**
 * Runtime Config Manager
 * Priority: app_settings table (DB) > process.env
 * Allows API keys to be overridden via the Settings UI without redeployment.
 */
import { supabase } from '../db/client.js';
const cache = new Map();
export async function loadConfigCache() {
    try {
        const { data } = await supabase.schema('listflow').from('app_settings').select('key, value');
        if (data) {
            for (const row of data) {
                cache.set(row.key, row.value);
            }
        }
        console.log(`[config] Loaded ${cache.size} settings from DB`);
    }
    catch (err) {
        console.warn('[config] Could not load settings from DB:', err);
    }
}
export async function getConfig(key) {
    // DB value takes priority
    if (cache.has(key) && cache.get(key))
        return cache.get(key);
    // Fall back to env
    return process.env[key];
}
export async function setConfig(key, value) {
    await supabase
        .schema('listflow')
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    cache.set(key, value);
}
export async function deleteConfig(key) {
    await supabase
        .schema('listflow')
        .from('app_settings')
        .delete()
        .eq('key', key);
    cache.delete(key);
}
export function getConfigSync(key) {
    if (cache.has(key) && cache.get(key))
        return cache.get(key);
    return process.env[key];
}
// Keys considered sensitive (masked in API responses)
export const SENSITIVE_KEYS = new Set([
    'ANTHROPIC_API_KEY',
    'DEEPGRAM_API_KEY',
    'GEMINI_API_KEY',
    'SUPABASE_SERVICE_KEY',
]);
export { cache as configCache };
