import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? 'http://localhost:55321'
const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_ANON_KEY ?? ''

if (!key) {
  console.warn('[listflow] WARNING: No SUPABASE_SERVICE_KEY set')
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
  db: { schema: 'listflow' },
})

// Typed helper — always queries listflow schema
// Uses the default schema set on the client (no .schema() call needed, avoids PostgREST schema header issues)
export const lf = (table: string) => supabase.from(table)
