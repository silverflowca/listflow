# ── Stage 1: Build client (React/Vite) ───────────────────────────────────────
FROM node:22-alpine AS client-builder
WORKDIR /client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
# Client uses relative URLs (/api, /ws) — no VITE_API_URL needed
# Supabase vars optional (only needed if client talks to Supabase directly)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# ── Stage 2: Build server (TypeScript → JS) ───────────────────────────────────
FROM node:22-alpine AS server-builder
WORKDIR /server
COPY server/package*.json ./
RUN npm ci
COPY server/ .
RUN npm run build

# ── Stage 3: Final runtime image ──────────────────────────────────────────────
FROM node:22-alpine AS runner

# Install nginx + supervisor
RUN apk add --no-cache nginx supervisor

WORKDIR /app

# Server: prod dependencies + compiled JS
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY --from=server-builder /server/dist ./server/dist

# Client: built static files
COPY --from=client-builder /client/dist ./public

# nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# supervisord config (manages nginx + node in one container)
COPY supervisord.conf /etc/supervisord.conf

# Railway sets PORT env var for the public-facing port — nginx listens on it.
# Node always listens on 3016 internally (nginx proxies to it).
ENV PORT=8080
ENV NODE_PORT=3016

EXPOSE 8080

CMD ["/bin/sh", "-c", \
  "sed -i \"s/listen 8080/listen ${PORT}/g\" /etc/nginx/http.d/default.conf && \
   supervisord -c /etc/supervisord.conf"]
