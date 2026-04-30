# ListFlow — Deployment Runbook

## Architecture

```
Railway (ONE service)
  nginx :$PORT (public)
    /api/*  → proxy → Node :3016 (internal)
    /ws     → proxy → Node :3016 (WebSocket upgrade)
    /       → serve React SPA
  Node :3016 (internal only — Hono server)
    ↕
    Supabase Cloud (listflow schema + storage)
```

One Railway service. One Dockerfile at `listflow/` root.
nginx + Node run in the same container via supervisord.
Client uses relative URLs (/api, /ws) — no VITE_API_URL needed.

---

## Step 1 — Supabase Cloud

### 1a. Create project
1. https://supabase.com → New Project
2. Note Project Ref and DB Password

### 1b. Run migration
Supabase Dashboard → SQL Editor → paste + run:

  listflow/migrations/listflow_cloud_migration.sql

Or via psql:
  psql "postgresql://postgres:PASSWORD@db.PROJECTREF.supabase.co:5432/postgres" < listflow/migrations/listflow_cloud_migration.sql

### 1c. Create audio storage bucket
Storage → New Bucket:
  Name: listflow-audio | Public: OFF | Size limit: 50MB | MIME: audio/*

### 1d. Collect credentials
Project Settings → API:
  SUPABASE_URL      = https://YOUR_PROJECT_REF.supabase.co
  SUPABASE_SERVICE_KEY = service_role key (secret)
  SUPABASE_ANON_KEY = anon key

---

## Step 2 — Railway (single service)

1. railway.app → New Project → Deploy from GitHub repo
2. Root Directory = listflow
3. Railway detects railway.json → uses Dockerfile

### Environment Variables

| Variable             | Value                                        |
|----------------------|----------------------------------------------|
| ALLOWED_ORIGIN       | https://your-app.up.railway.app              |
| NO_AUTH              | false                                        |
| SUPABASE_URL         | https://YOUR_PROJECT_REF.supabase.co         |
| SUPABASE_SERVICE_KEY | service_role key                             |
| SUPABASE_ANON_KEY    | anon key                                     |
| DEEPGRAM_API_KEY     | your key                                     |
| ANTHROPIC_API_KEY    | your key                                     |
| GEMINI_API_KEY       | your key (optional)                          |
| VITE_SUPABASE_URL    | same as SUPABASE_URL (baked into client)     |
| VITE_SUPABASE_ANON_KEY | same as SUPABASE_ANON_KEY                  |

NOTE: Do NOT set VITE_API_URL or VITE_WS_URL — client uses relative URLs via nginx proxy.

ALLOWED_ORIGIN tip: on first deploy set to * temporarily, update after you know the URL, redeploy.

---

## Step 3 — Verify

  curl https://your-app.up.railway.app/health
  # → {"ok":true,"service":"listflow-server"}

  open https://your-app.up.railway.app
  # → ListFlow UI, WebSocket connects

---

## Deployment Files

| File               | Purpose                                              |
|--------------------|------------------------------------------------------|
| Dockerfile         | 3-stage: build client + server, run both with supervisord |
| nginx.conf         | Serves SPA, proxies /api + /ws to Node :3016         |
| supervisord.conf   | Runs nginx + Node in same container                  |
| railway.json       | Railway config — root Dockerfile, healthcheck /health |
| migrations/listflow_cloud_migration.sql | Combined Supabase migration     |

---

## Local Development

  # From silverflow root
  npx supabase start

  # Run migrations (first time only)
  docker exec -i supabase_db_silverflow psql -U postgres -d postgres < supabase/migrations/20260424000002_listflow_schema.sql
  docker exec -i supabase_db_silverflow psql -U postgres -d postgres < supabase/migrations/20260430000001_listflow_users_groups.sql

  # Server (port 3016)
  cd listflow/server && npm run dev

  # Client (port 5186 — Vite proxies /api + /ws to :3016)
  cd listflow/client && npm run dev

---

## Rollback

Railway → service → Deployments → previous → Rollback

DB nuclear reset: DROP SCHEMA listflow CASCADE;
