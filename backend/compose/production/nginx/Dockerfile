# ---------- Build React frontend ----------
FROM node:24-alpine AS frontend-build

WORKDIR /frontend
RUN corepack enable

# Correct path (relative to repo root)
COPY frontend/ ./
COPY .envs/.production/.react .env.production

# Install dependencies
RUN pnpm install --frozen-lockfile

RUN pnpm build


# ---------- Final nginx image ----------
FROM nginx:1.29.5-alpine

# Install envsubst support for runtime config if needed
RUN apk add --no-cache gettext

# Copy built React app
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html

COPY backend/compose/production/nginx/default.conf /etc/nginx/conf.d/default.conf
