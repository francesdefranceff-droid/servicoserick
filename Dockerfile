# ============================================================
# Multi-stage Dockerfile - modelo "jatai-app"
# Stage 1: Build do frontend Vite (raiz do repo)
# Stage 2: FastAPI servindo API em /api + frontend estático em /
# Resultado: 1 container, 1 porta ($PORT injetado pelo Render)
# ============================================================

# ---------- Stage 1: Build do frontend Vite ----------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Envs do Vite são embedadas no build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_GOOGLE_MAPS_API_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
    VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

COPY package.json package-lock.json* bun.lockb* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build


# ---------- Stage 2: Python / FastAPI ----------
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r backend/requirements.txt && \
    pip install --no-cache-dir "qrcode[pil]==7.4.2"

COPY backend/ ./backend/

# Build do Vite cai em /app/dist; serve_static.py espera /app/frontend_build
COPY --from=frontend-builder /app/dist ./frontend_build

# Garante mount do frontend no app FastAPI (idempotente)
RUN python -c "import io; \
content = open('/app/backend/server.py','r').read(); \
patch = '\n\n# === SPA Frontend Mount (production) ===\ntry:\n    from serve_static import mount_frontend\n    mount_frontend(app)\nexcept Exception as _e:\n    print(\"Frontend mount skipped:\", _e)\n'; \
open('/app/backend/server.py','w').write(content + patch) if 'mount_frontend(app)' not in content else None"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=10000
EXPOSE 10000

WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-10000}"]
