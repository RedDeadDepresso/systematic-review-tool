# ---------- Build React frontend ----------
FROM node:24-alpine AS frontend-build

WORKDIR /frontend
RUN corepack enable

# Correct path (relative to repo root)
COPY frontend/ ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build-time env vars for Vite
ARG VITE_API_BASE_URL
ARG VITE_WS_URL

RUN VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_URL=$VITE_WS_URL \
    pnpm build


# ---------- Final nginx image ----------
FROM nginx:1.29.5-alpine

# Install envsubst support for runtime config if needed
RUN apk add --no-cache gettext

# Copy built React app
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html

COPY backend/compose/production/nginx/default.conf /etc/nginx/conf.d/default.conf
