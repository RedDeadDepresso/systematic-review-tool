FROM node:24-alpine

# Enable pnpm via Corepack (no global install needed)
RUN corepack enable

# Set working directory inside container
WORKDIR /frontend

# Copy only dependency files for caching
COPY package.json pnpm-lock.yaml ./

# Use cache for pnpm store to speed up builds
RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .