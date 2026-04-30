/**
 * Runtime Config Manager
 * Priority: app_settings table (DB) > process.env
 * Allows API keys to be overridden via the Settings UI without redeployment.
 */

import { supabase } from '../db/client.js'

const cache = new Map<string, string>()

export async function loadConfigCache(): Promise<void> {
  try {
    const { data } = await supabase.from('app_settings').select('key, value')
    if (data) {
      for (const row of data as { key: string; value: string }[]) {
        cache.set(row.key, row.value)
      }
    }
    console.log(`[config] Loaded ${cache.size} settings from DB`)
  } catch (err) {
    console.warn('[config] Could not load settings from DB:', err)
  }
}

export async function getConfig(key: string): Promise<string | undefined> {
  // DB value takes priority
  if (cache.has(key) && cache.get(key)) return cache.get(key)
  // Fall back to env
  return process.env[key]
}

export async function setConfig(key: string, value: string): Promise<void> {
  await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  cache.set(key, value)
}

export async function deleteConfig(key: string): Promise<void> {
  await supabase
    .from('app_settings')
    .delete()
    .eq('key', key)
  cache.delete(key)
}

export function getConfigSync(key: string): string | undefined {
  if (cache.has(key) && cache.get(key)) return cache.get(key)
  return process.env[key]
}

// Keys considered sensitive (masked in API responses)
export const SENSITIVE_KEYS = new Set([
  'ANTHROPIC_API_KEY',
  'DEEPGRAM_API_KEY',
  'GEMINI_API_KEY',
  'SUPABASE_SERVICE_KEY',
])

export { cache as configCache }
