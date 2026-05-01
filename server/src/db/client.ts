import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? 'http://localhost:55321'
const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

if (!key) {
  console.warn('[listflow] WARNING: No SUPABASE_SERVICE_KEY set')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
})

// Typed helper — queries listflow schema explicitly per-call
export const lf = (table: string) => supabase.schema('listflow').from(table)
