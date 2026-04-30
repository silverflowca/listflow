# ListFlow — Deployment Runbook

## Architecture

```
Railway (listflow-server)      Railway (listflow-client)
  Hono + Node 22 on port 3016   nginx on port 80
  ↕                             ↕
  Supabase Cloud (listflow schema)
  Supabase Storage (listflow-audio bucket)
```

Both services are deployed as separate Railway services in the same Railway project.
The client's `VITE_API_URL` and `VITE_WS_URL` are baked in at **build time** — they point directly
to the server Railway URL. nginx serves the SPA and proxies nothing at runtime (all API calls
go directly from browser to the server URL).

---

## Step 1 — Supabase Cloud Setup

### 1a. Create Supabase project
1. Go to https://supabase.com → New Project
2. Note your **Project Ref** (e.g. `abcdefghijklmnop`)
3. Note your **Database Password**

### 1b. Run the migration
Open the Supabase **SQL Editor** and paste + run:

```
listflow/migrations/listflow_cloud_migration.sql
```

This creates the `listflow` schema with 18 tables, enums, indexes, RLS policies, and seeds
the default config matrix.

**Alternative (psql):**
```bash
psql "postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres" \
  < listflow/migrations/listflow_cloud_migration.sql
```

### 1c. Create the audio storage bucket
1. Supabase Dashboard → Storage → New Bucket
2. Name: `listflow-audio`
3. Public: **OFF** (private)
4. File size limit: `50 MB`
5. Allowed MIME types: `audio/webm, audio/mp4, audio/mpeg, audio/ogg, audio/wav`

### 1d. Collect credentials
From **Supabase Dashboard → Project Settings → API**:
- `SUPABASE_URL` = `https://YOUR_PROJECT_REF.supabase.co`
- `SUPABASE_SERVICE_KEY` = service_role key (secret — server only)
- `SUPABASE_ANON_KEY` = anon key (safe for browser)

---

## Step 2 — Railway Project Setup

1. Go to https://railway.app → New Project → Empty Project
2. Name it `listflow`

---

## Step 3 — Deploy the Server

### 3a. Create server service
1. Railway project → **+ New Service** → **GitHub Repo**
2. Select your repo, set **Root Directory** to `listflow/server`
3. Railway auto-detects the `Dockerfile`

### 3b. Set server environment variables
In the service → **Variables** tab, add:

| Variable | Value |
|---|---|
| `PORT` | `3016` |
| `ALLOWED_ORIGIN` | `https://YOUR_CLIENT_RAILWAY_URL` (set after client deploys — update later) |
| `NO_AUTH` | `false` |
| `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `SUPABASE_SERVICE_KEY` | your service_role key |
| `SUPABASE_ANON_KEY` | your anon key |
| `DEEPGRAM_API_KEY` | your Deepgram key |
| `ANTHROPIC_API_KEY` | your Anthropic key |
| `GEMINI_API_KEY` | your Gemini key |

### 3c. Deploy
- Click **Deploy** or push to the connected branch
- Wait for build → health check hits `/health` → service is live
- Note the server URL: `https://listflow-server-XXXX.up.railway.app`

---

## Step 4 — Deploy the Client

### 4a. Create client service
1. Railway project → **+ New Service** → **GitHub Repo**
2. Select your repo, set **Root Directory** to `listflow/client`
3. Railway auto-detects the `Dockerfile`

### 4b. Set client build variables
In the service → **Variables** tab, add:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://listflow-server-XXXX.up.railway.app` |
| `VITE_WS_URL` | `wss://listflow-server-XXXX.up.railway.app` |
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon key |
| `BACKEND_HOST` | `listflow-server-XXXX.up.railway.app` (for nginx runtime proxy) |

> **CRITICAL:** `VITE_*` variables are baked into the JS bundle at build time.
> After changing any `VITE_*` variable you **must trigger a new build** (redeploy).

### 4c. Deploy
- Click **Deploy**
- Note the client URL: `https://listflow-client-XXXX.up.railway.app`

### 4d. Update server ALLOWED_ORIGIN
Go back to the **server service → Variables** and update:
```
ALLOWED_ORIGIN = https://listflow-client-XXXX.up.railway.app
```
Then redeploy the server.

---

## Step 5 — Verify Deployment

```bash
# 1. Server health
curl https://listflow-server-XXXX.up.railway.app/health
# Expected: {"ok":true,"service":"listflow-server","port":3016}

# 2. Client loads
open https://listflow-client-XXXX.up.railway.app
# Should see ListFlow UI

# 3. Test API via client
# Open browser DevTools → Network → create a workspace
# Check for 200 responses to /api/workspaces

# 4. WebSocket
# Open browser DevTools → Network → WS tab
# Should see a connected WebSocket at wss://server-url/ws
```

---

## Step 6 — Custom Domain (optional)

1. Railway service → **Settings** → **Networking** → **Custom Domain**
2. Add your domain (e.g. `app.listflow.com` → client, `api.listflow.com` → server)
3. Update `VITE_API_URL`, `VITE_WS_URL`, and `ALLOWED_ORIGIN` accordingly
4. Redeploy both services

---

## Environment Variables Reference

### Server (`listflow/server`)
| Variable | Required | Description |
|---|---|---|
| `PORT` | yes | Server port (3016) |
| `ALLOWED_ORIGIN` | yes | Client URL for CORS |
| `NO_AUTH` | yes | `false` in production |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | yes | service_role key (secret) |
| `SUPABASE_ANON_KEY` | yes | anon key |
| `DEEPGRAM_API_KEY` | yes | Audio transcription |
| `ANTHROPIC_API_KEY` | yes | Claude AI agent |
| `GEMINI_API_KEY` | optional | Gemini alternative |
| `FILEFLOW_URL` | optional | FileFlow mirror URL |
| `FILEFLOW_EMAIL` | optional | FileFlow credentials |
| `FILEFLOW_PASSWORD` | optional | FileFlow credentials |

### Client (`listflow/client`) — build-time only
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | yes | Server URL (https://...) |
| `VITE_WS_URL` | yes | Server WebSocket URL (wss://...) |
| `VITE_SUPABASE_URL` | yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | anon key |
| `BACKEND_HOST` | optional | nginx runtime proxy host |

---

## Migrations

All migrations are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).

| File | Contents |
|---|---|
| `migrations/listflow_cloud_migration.sql` | **Combined** — run this on cloud |
| `../../supabase/migrations/20260424000002_listflow_schema.sql` | Core schema (local dev) |
| `../../supabase/migrations/20260430000001_listflow_users_groups.sql` | Users/groups/config (local dev) |

### To re-run migration (safe — idempotent)
```bash
psql "postgresql://postgres:PASSWORD@db.PROJECTREF.supabase.co:5432/postgres" \
  < listflow/migrations/listflow_cloud_migration.sql
```

---

## Local Development

```bash
# 1. Start Supabase (from silverflow root)
cd "c:\Users\User\Documents\Kingdom Business\EFHCI\dev\silverflow"
npx supabase start

# 2. Run local migrations (if not done)
docker exec -i supabase_db_silverflow psql -U postgres -d postgres \
  < supabase/migrations/20260424000002_listflow_schema.sql
docker exec -i supabase_db_silverflow psql -U postgres -d postgres \
  < supabase/migrations/20260430000001_listflow_users_groups.sql

# 3. Start server (dev mode)
cd listflow/server
cp .env.example .env   # fill in keys
npm run dev            # port 3016

# 4. Start client (dev mode)
cd listflow/client
npm run dev            # port 5186
```

---

## Rollback

If something breaks:
1. Railway → service → **Deployments** tab → click previous deployment → **Rollback**
2. DB rollback: migrations are additive — no destructive changes. Tables can be dropped manually if needed:
   ```sql
   DROP SCHEMA listflow CASCADE;
   ```
