# ---------- Build React frontend ----------
FROM node:24-alpine AS frontend-build

WORKDIR /frontend
RUN corepack enable

# Copy only frontend code (from sibling directory of backend)
COPY ../../../frontend/ ./

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

# Copy custom boot script (if you use runtime env substitution)
COPY ./backend/compose/production/nginx/boot.sh /home/docker/scripts/boot.sh

# Normalize line endings and make the boot script executable
RUN sed -i 's/\r$//' /home/docker/scripts/boot.sh && \
    chmod +x /home/docker/scripts/boot.sh

# Copy Nginx config
COPY ./backend/compose/production/nginx/default.conf /etc/nginx/conf.d/default.conf
